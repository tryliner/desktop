import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Refresh1Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import {
  useOverlaySettingsStore,
  type OverlayPosition,
  getEnglishKeyFromEvent,
  normalizeShortcutToEnglish,
} from "@/features/overlay";
import { ToggleSwitch } from "@/shared/ui";
import { SettingRow, SettingSection, SegmentedControl } from "../controls";

const POSITION_OPTIONS = [
  { value: "top-left" as const, label: "Top Left" },
  { value: "top-center" as const, label: "Top Middle" },
  { value: "top-right" as const, label: "Top Right" },
] as const;

const DEFAULT_SHORTCUT = "Alt+Shift+O";

function formatAcceleratorForDisplay(accelerator: string): string {
  if (!accelerator) return "None";
  return accelerator
    .split("+")
    .map((p) => {
      if (p === "Control" || p === "CommandOrControl") return "Ctrl";
      if (p === "Command") return "Cmd";
      return p;
    })
    .join(" + ");
}

export function OverlayTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();

  const enabled = useOverlaySettingsStore((s) => s.enabled);
  const setEnabled = useOverlaySettingsStore((s) => s.setEnabled);

  const position = useOverlaySettingsStore((s) => s.position);
  const setPosition = useOverlaySettingsStore((s) => s.setPosition);

  const shortcut = useOverlaySettingsStore((s) => s.shortcut);
  const setShortcut = useOverlaySettingsStore((s) => s.setShortcut);

  const autoShowOnMinimize = useOverlaySettingsStore((s) => s.autoShowOnMinimize);
  const setAutoShowOnMinimize = useOverlaySettingsStore((s) => s.setAutoShowOnMinimize);

  const alwaysOnTop = useOverlaySettingsStore((s) => s.alwaysOnTop);
  const setAlwaysOnTop = useOverlaySettingsStore((s) => s.setAlwaysOnTop);

  const [isRecording, setIsRecording] = useState(false);
  const [heldModifiers, setHeldModifiers] = useState<string[]>([]);
  const recordButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) {
      setHeldModifiers([]);
      return;
    }

    const updateModifiers = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Cmd");
      setHeldModifiers(parts);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setHeldModifiers([]);
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

      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      const isFKey = /^F\d{1,2}$/i.test(englishKey);

      if (!hasModifier && !isFKey) {
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Command");
      parts.push(englishKey);

      const normalized = normalizeShortcutToEnglish(parts.join("+"));
      if (normalized) {
        setShortcut(normalized);
        setHeldModifiers([]);
        setIsRecording(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateModifiers(e);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (recordButtonRef.current && !recordButtonRef.current.contains(e.target as Node)) {
        setHeldModifiers([]);
        setIsRecording(false);
      }
    };

    const handleWindowBlur = () => {
      setHeldModifiers([]);
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
  }, [isRecording, setShortcut]);

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.overlay.enabled.title") || "Enable overlay"}
        description={
          t("settings.overlay.enabled.description") ||
          "Show a floating miniature player above other windows."
        }
        titleKey="settings.overlay.enabled.title"
        descKey="settings.overlay.enabled.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={enabled}
            onChange={setEnabled}
          />
        }
      />

      <div
        className={
          enabled
            ? "flex flex-col divide-y divide-solid divide-border-primary transition-all duration-200"
            : "flex flex-col divide-y divide-solid divide-border-primary opacity-40 grayscale pointer-events-none select-none transition-all duration-200"
        }
      >
        <SettingRow
          title={t("settings.overlay.position.title") || "Position"}
          description={
            t("settings.overlay.position.description") ||
            "Choose where the overlay appears on your desktop."
          }
          titleKey="settings.overlay.position.title"
          descKey="settings.overlay.position.description"
          searchQuery={searchQuery}
          control={
            <SegmentedControl<OverlayPosition>
              options={POSITION_OPTIONS}
              value={position}
              onChange={setPosition}
              disabled={!enabled}
              ariaLabel="Overlay Position"
            />
          }
        />

        <SettingRow
          title={t("settings.overlay.shortcut.title") || "Global shortcut"}
          description={
            t("settings.overlay.shortcut.description") ||
            "Toggle the desktop overlay from any application across the system."
          }
          titleKey="settings.overlay.shortcut.title"
          descKey="settings.overlay.shortcut.description"
          searchQuery={searchQuery}
          control={
            <div className="flex items-center gap-1.5">
              <AnimatePresence>
                {shortcut !== DEFAULT_SHORTCUT && enabled && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    title={t("settings.overlay.shortcut.reset") || "Reset to Alt+Shift+O"}
                    aria-label={t("settings.overlay.shortcut.reset") || "Reset shortcut"}
                    onClick={() => {
                      setHeldModifiers([]);
                      setIsRecording(false);
                      setShortcut(DEFAULT_SHORTCUT);
                    }}
                    className="h-[28px] w-[28px] rounded-lg border-0 outline-none flex items-center justify-center bg-border-alpha-14 hover:bg-border-alpha-20 text-text-secondary hover:text-text-primary transition-colors cursor-pointer select-none active:scale-[0.95]"
                  >
                    <Refresh1Line size={15} />
                  </motion.button>
                )}
              </AnimatePresence>

              <button
                ref={recordButtonRef}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  if (enabled) {
                    setHeldModifiers([]);
                    setIsRecording((prev) => !prev);
                  }
                }}
                className={`h-[28px] px-3 rounded-lg text-[12.5px] font-medium transition-colors flex items-center justify-center border-0 outline-none select-none ${
                  !enabled
                    ? "bg-border-alpha-10 text-text-tertiary cursor-not-allowed opacity-50"
                    : isRecording
                      ? heldModifiers.length > 0
                        ? "bg-border-alpha-20 text-text-primary cursor-pointer"
                        : "bg-border-alpha-20 text-text-secondary cursor-pointer"
                      : "bg-border-alpha-14 hover:bg-border-alpha-20 text-text-primary cursor-pointer active:scale-[0.99]"
                }`}
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isRecording ? (
                    <motion.span
                      key={heldModifiers.length > 0 ? heldModifiers.join("+") : "waiting"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.08, ease: "easeOut" }}
                      className={heldModifiers.length > 0 ? "leading-none" : "tracking-widest leading-none"}
                    >
                      {heldModifiers.length > 0 ? `${heldModifiers.join(" + ")} + ...` : "···"}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="display"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1, ease: "easeOut" }}
                      className="leading-none"
                    >
                      {formatAcceleratorForDisplay(shortcut)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          }
        />

        <SettingRow
          title={
            t("settings.overlay.auto_show_on_minimize.title") ||
            "Auto-show on minimize"
          }
          description={
            t("settings.overlay.auto_show_on_minimize.description") ||
            "Automatically show the overlay when Liner is minimized."
          }
          titleKey="settings.overlay.auto_show_on_minimize.title"
          descKey="settings.overlay.auto_show_on_minimize.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={autoShowOnMinimize}
              onChange={setAutoShowOnMinimize}
              disabled={!enabled}
            />
          }
        />

        <SettingRow
          title={t("settings.overlay.always_on_top.title") || "Always on top"}
          description={
            t("settings.overlay.always_on_top.description") ||
            "Keep the overlay floating above other windows."
          }
          titleKey="settings.overlay.always_on_top.title"
          descKey="settings.overlay.always_on_top.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={alwaysOnTop}
              onChange={setAlwaysOnTop}
              disabled={!enabled}
            />
          }
        />
      </div>
    </SettingSection>
  );
}

export default OverlayTab;
