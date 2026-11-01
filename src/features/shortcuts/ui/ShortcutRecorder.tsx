import { useState, useRef, useEffect, useCallback } from "react";
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

export interface ShortcutRecorderProps {
  value: string;
  defaultValue: string;
  onChange: (newValue: string) => void;
  onReset: () => void;
  isGlobal?: boolean;
  validateCandidate?: (candidate: string) => { conflictWith: string } | null;
  disabled?: boolean;
  isRecording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
}

export function ShortcutRecorder({
  value,
  onChange,
  isGlobal = false,
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

      updateModifiers(e);

      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

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
    validateCandidate,
    onChange,
    t,
    isControlled,
    setIsRecording,
  ]);

  return (
    <div className="relative flex items-center gap-1.5 shrink-0 h-[30px]">
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
        className={`transition-all flex items-center justify-center border-0 outline-none select-none cursor-pointer ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-transparent"
            : isRecording
              ? errorMessage
                ? "h-[30px] px-[12px] rounded-[8px] bg-rose-700/90 text-white"
                : heldModifiers.length > 0
                  ? "h-[30px] px-[12px] rounded-[8px] bg-black/[0.12] text-text-primary dark:bg-black/50"
                  : "h-[30px] px-[12px] rounded-[8px] bg-black/[0.08] text-text-secondary dark:bg-black/40"
              : "bg-transparent p-0"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isRecording ? (
            <motion.span
              key={
                errorMessage
                  ? "error"
                  : heldModifiers.length > 0
                    ? heldModifiers.join("+")
                    : "waiting"
              }
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{ duration: 0.08, ease: "easeOut" }}
              className="flex items-center gap-[8px] leading-none text-[13px] font-medium"
            >
              {heldModifiers.length > 0
                ? `${heldModifiers.join(" + ")} + ...`
                : t("settings.shortcuts.press_keys") || "···"}
              {errorMessage && (
                <CloseCircleFill size={15} className="shrink-0 opacity-80" />
              )}
            </motion.span>
          ) : (
            <motion.div
              key="display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="flex items-center gap-1 select-none"
            >
              {getAcceleratorKeycaps(value).map((chip, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center justify-center min-w-[30px] h-[30px] px-[10px] rounded-[8px] bg-black/[0.08] text-text-primary text-[13px] font-[500] leading-none transition-colors group-hover:bg-black/[0.12] dark:bg-black/40 dark:group-hover:bg-black/50"
                >
                  {chip}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Floating Conflict Tooltip - Zero layout shift & completely borderless */}
      <AnimatePresence>
        {isRecording && errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute left-0 top-full mt-[6px] z-40 pointer-events-none whitespace-nowrap px-[10px] py-[6px] rounded-[8px] bg-rose-600 shadow-xl flex items-center gap-1.5 text-[12px] font-[500] text-white select-none border-0"
          >
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
