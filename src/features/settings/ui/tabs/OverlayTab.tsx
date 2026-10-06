import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/languages";
import { useOverlaySettingsStore, type OverlayPosition } from "@/features/overlay";
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
  const recordButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Command");

      if (parts.length === 0 && !/^F\d{1,2}$/i.test(e.key)) {
        return;
      }

      let key = e.key;
      if (key === " ") key = "Space";
      else if (key.length === 1) key = key.toUpperCase();

      parts.push(key);
      const newShortcut = parts.join("+");
      setShortcut(newShortcut);
      setIsRecording(false);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (recordButtonRef.current && !recordButtonRef.current.contains(e.target as Node)) {
        setIsRecording(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("mousedown", handleMouseDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
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
            <div className="flex items-center gap-2">
              <button
                ref={recordButtonRef}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && setIsRecording((prev) => !prev)}
                className={`h-[28px] px-3 rounded-lg text-[12.5px] font-medium transition-all flex items-center gap-1.5 border ${
                  !enabled
                    ? "bg-border-alpha-10 border-transparent text-text-tertiary cursor-not-allowed opacity-50"
                    : isRecording
                      ? "bg-accent-primary/10 border-accent-primary text-accent-primary ring-2 ring-accent-primary/20 cursor-pointer"
                      : "bg-border-alpha-14 border-transparent text-text-primary hover:bg-border-alpha-20 cursor-pointer"
                }`}
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >
                {isRecording ? (
                  <span className="animate-pulse">Press keys (Esc to cancel)...</span>
                ) : (
                  <span>{formatAcceleratorForDisplay(shortcut)}</span>
                )}
              </button>
              {shortcut !== DEFAULT_SHORTCUT && enabled && (
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => setShortcut(DEFAULT_SHORTCUT)}
                  className="text-[11.5px] text-text-tertiary hover:text-text-primary underline cursor-pointer bg-transparent border-0 p-0"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  Reset
                </button>
              )}
            </div>
          }
        />

        <SettingRow
          title={t("settings.overlay.auto_show_on_minimize.title") || "Auto-show on minimize"}
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
