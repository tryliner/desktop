import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloseCircleFill } from "@mingcute/react";

import { useTranslation } from "@/languages";
import {
  getEnglishKeyFromEvent,
  normalizeShortcutToEnglish,
  getAcceleratorKeycaps,
  isMacPlatform,
} from "../utils/shortcutMatching";
import { useShortcutsStore } from "../store/shortcutsStore";
import { acquireEscapeGuard } from "@/shared/utils/escapeGuard";
import { useElementSize } from "@/shared/hooks/useElementSize";

const TOOLTIP_EDGE_GAP = 8;
const RECORDER_EASE = [0.32, 0.72, 0, 1] as const;
const RECORDER_TRANSITION =
  "width 220ms cubic-bezier(0.32, 0.72, 0, 1), background-color 200ms ease-out, color 200ms ease-out";
const RECORDER_FADE_IN = { duration: 0.16, ease: RECORDER_EASE, delay: 0.04 };
const RECORDER_FADE_OUT = { duration: 0.1, ease: "easeOut" } as const;

interface TooltipPlacement {
  left: number;
  maxWidth?: number;
}

function findClippingRect(from: HTMLElement): DOMRect {
  let node = from.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.overflowX !== "visible" || style.overflow !== "visible") {
      return node.getBoundingClientRect();
    }
    node = node.parentElement;
  }
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

export function placeTooltipInside(
  anchorLeft: number,
  tooltipWidth: number,
  bounds: { left: number; right: number },
): TooltipPlacement {
  const minLeft = bounds.left + TOOLTIP_EDGE_GAP;
  const maxRight = bounds.right - TOOLTIP_EDGE_GAP;
  const room = Math.max(0, maxRight - minLeft);
  const width = Math.min(tooltipWidth, room);
  const left = Math.max(minLeft, Math.min(anchorLeft, maxRight - width));
  return {
    left: Math.round(left - anchorLeft),
    maxWidth: tooltipWidth > room ? room : undefined,
  };
}

export interface ShortcutRecorderProps {
  value: string;
  defaultValue: string;
  onChange: (newValue: string) => void;
  onReset: () => void;
  isGlobal?: boolean;
  clearable?: boolean;
  validateCandidate?: (candidate: string) => { conflictWith: string } | null;
  disabled?: boolean;
  isRecording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
}

export function ShortcutRecorder({
  value,
  onChange,
  isGlobal = false,
  clearable = false,
  validateCandidate,
  disabled = false,
  isRecording: isRecordingProp,
  onRecordingChange,
}: ShortcutRecorderProps) {
  const { t } = useTranslation();
  const [internalIsRecording, setInternalIsRecording] = useState(false);
  const isControlled = isRecordingProp !== undefined;
  const isRecording = isControlled ? isRecordingProp : internalIsRecording;

  const setIsRecording = useCallback(
    (val: boolean | ((prev: boolean) => boolean)) => {
      const nextVal = typeof val === "function" ? val(isRecording) : val;
      if (isControlled) {
        onRecordingChange?.(nextVal);
      } else {
        setInternalIsRecording(nextVal);
      }
    },
    [isRecording, isControlled, onRecordingChange],
  );

  const [heldModifiers, setHeldModifiers] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const content = useElementSize<HTMLSpanElement>();
  const [tooltipPlacement, setTooltipPlacement] = useState<TooltipPlacement>({
    left: 0,
  });
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync global shortcut suspension in Electron and main player engine
  useEffect(() => {
    useShortcutsStore.getState().setIsRecording(isRecording);
    // Esc cancels recording instead of closing the surrounding dialog
    const releaseEscape = isRecording ? acquireEscapeGuard() : null;
    return () => {
      releaseEscape?.();
      useShortcutsStore.getState().setIsRecording(false);
    };
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) {
      setHeldModifiers([]);
      setErrorMessage(null);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      return;
    }

    const isMac = isMacPlatform();
    const keysSeenDown = new Set<string>();
    const isModifierKey = (key: string) =>
      ["Control", "Shift", "Alt", "Meta"].includes(key);

    const triggerError = (msg: string) => {
      setErrorMessage(msg);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setErrorMessage(null);
      }, 2500);
    };

    const updateModifiers = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push(isMac ? "Opt" : "Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push(isMac ? "Cmd" : "Win");
      setHeldModifiers(parts);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setHeldModifiers([]);
        setErrorMessage(null);
        setIsRecording(false);
        return;
      }

      const hasAnyModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      if (
        clearable &&
        !hasAnyModifier &&
        (e.key === "Backspace" || e.key === "Delete")
      ) {
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        setErrorMessage(null);
        setHeldModifiers([]);
        setIsRecording(false);
        onChange("");
        return;
      }

      updateModifiers(e);

      if (isModifierKey(e.key)) {
        return;
      }
      keysSeenDown.add(e.code || e.key);

      const englishKey = getEnglishKeyFromEvent(e);
      if (!englishKey) {
        return;
      }

      const hasMod = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      const isFKey = /^F\d{1,2}$/i.test(englishKey);

      // Global shortcuts require at least one modifier
      if (isGlobal && !hasMod && !isFKey) {
        const msg =
          t("settings.shortcuts.modifier_required") ||
          "Global shortcuts require Ctrl, Alt, or Shift";
        triggerError(msg);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Command");
      parts.push(englishKey);

      const candidate = normalizeShortcutToEnglish(parts.join("+"));
      if (!candidate) return;

      // Check for conflict with other actions in the same scope
      if (validateCandidate) {
        const conflict = validateCandidate(candidate);
        if (conflict) {
          const conflictTemplate =
            t("settings.shortcuts.conflict_error") ||
            `Already used by "${conflict.conflictWith}"`;
          const formatted = conflictTemplate.replace(
            "{action}",
            conflict.conflictWith,
          );
          triggerError(formatted);
          return;
        }
      }

      // Valid and non-conflicting: commit and exit recording
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      setErrorMessage(null);
      setHeldModifiers([]);
      setIsRecording(false);
      onChange(candidate);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateModifiers(e);
      const hasMod = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      if (
        hasMod &&
        !isModifierKey(e.key) &&
        !keysSeenDown.has(e.code || e.key)
      ) {
        triggerError(
          t("settings.shortcuts.taken_by_other_app") ||
            "Taken by the system or another app",
        );
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isControlled) return;
      if (
        recordButtonRef.current &&
        !recordButtonRef.current.contains(e.target as Node)
      ) {
        setHeldModifiers([]);
        setErrorMessage(null);
        setIsRecording(false);
      }
    };

    const handleWindowBlur = () => {
      setHeldModifiers([]);
      setErrorMessage(null);
      setIsRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    isRecording,
    isGlobal,
    clearable,
    validateCandidate,
    onChange,
    t,
    isControlled,
    setIsRecording,
  ]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const tooltip = tooltipRef.current;
    if (!isRecording || !errorMessage || !root || !tooltip) {
      setTooltipPlacement({ left: 0 });
      return;
    }
    const { maxWidth, whiteSpace } = tooltip.style;
    tooltip.style.maxWidth = "none";
    tooltip.style.whiteSpace = "nowrap";
    const naturalWidth = tooltip.scrollWidth;
    tooltip.style.maxWidth = maxWidth;
    tooltip.style.whiteSpace = whiteSpace;
    setTooltipPlacement(
      placeTooltipInside(
        root.getBoundingClientRect().left,
        naturalWidth,
        findClippingRect(root),
      ),
    );
  }, [isRecording, errorMessage]);

  return (
    <div
      ref={rootRef}
      className="relative flex items-center gap-1.5 shrink-0 h-[30px]"
    >
      <button
        ref={recordButtonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            setHeldModifiers([]);
            setErrorMessage(null);
            setIsRecording((prev) => !prev);
          }
        }}
        style={{
          width: content.size?.width,
          transition: RECORDER_TRANSITION,
        }}
        className={`relative flex h-[30px] items-center justify-start overflow-hidden rounded-control p-0 border-0 outline-none select-none cursor-pointer ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-transparent"
            : isRecording
              ? errorMessage
                ? "bg-rose-700/90 text-white"
                : heldModifiers.length > 0
                  ? "bg-black/[0.12] text-text-primary dark:bg-black/50"
                  : "bg-black/[0.08] text-text-secondary dark:bg-black/40"
              : "bg-transparent"
        }`}
      >
        <span
          ref={content.attach}
          className="inline-flex h-full shrink-0 items-center whitespace-nowrap"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {isRecording ? (
              <motion.span
                key={
                  errorMessage
                    ? "error"
                    : heldModifiers.length > 0
                      ? heldModifiers.join("+")
                      : "waiting"
                }
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0, transition: RECORDER_FADE_IN }}
                exit={{ opacity: 0, y: 3, transition: RECORDER_FADE_OUT }}
                className="flex h-[30px] items-center gap-[8px] px-[12px] leading-none text-body font-medium"
              >
                {heldModifiers.length > 0
                  ? `${heldModifiers.join(" + ")} + ...`
                  : t("settings.shortcuts.press_keys") || "···"}
                {errorMessage && (
                  <CloseCircleFill size={15} className="shrink-0 opacity-80" />
                )}
              </motion.span>
            ) : (
              <motion.span
                key="display"
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0, transition: RECORDER_FADE_IN }}
                exit={{ opacity: 0, y: 3, transition: RECORDER_FADE_OUT }}
                className="flex items-center gap-1 select-none"
              >
                {!value ? (
                  <span className="inline-flex items-center justify-center h-[30px] px-[10px] rounded-control bg-black/[0.05] text-text-tertiary text-body font-[500] leading-none dark:bg-black/25">
                    {t("settings.shortcuts.not_set") || "Not set"}
                  </span>
                ) : (
                  getAcceleratorKeycaps(value).map((chip, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center justify-center min-w-[30px] h-[30px] px-[10px] rounded-control bg-black/[0.08] text-text-primary text-body font-[500] leading-none transition-colors group-hover:bg-black/[0.12] dark:bg-black/40 dark:group-hover:bg-black/50"
                    >
                      {chip}
                    </span>
                  ))
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </button>

      {/* Floating Conflict Tooltip - Zero layout shift & completely borderless */}
      <AnimatePresence>
        {isRecording && errorMessage && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{
              left: tooltipPlacement.left,
              maxWidth: tooltipPlacement.maxWidth,
            }}
            className={`absolute top-full mt-[6px] z-40 pointer-events-none px-[10px] py-[6px] rounded-control bg-rose-600 shadow-xl flex items-center gap-1.5 text-caption font-[500] text-white select-none border-0 ${
              tooltipPlacement.maxWidth
                ? "whitespace-normal"
                : "whitespace-nowrap"
            }`}
          >
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
