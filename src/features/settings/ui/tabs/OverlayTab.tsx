import { useState, useRef, useEffect } from "react";
import { Refresh1Line } from "@mingcute/react";
import { useTranslation } from "@/languages";
import {
  useOverlaySettingsStore,
  type OverlayPosition,
  getEnglishKeyFromEvent,
  getKeyDisplay,
  splitShortcutParts,
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

function KeyCap({
  label,
  symbol,
  isModifier,
  highlighted,
}: {
  label: string;
  symbol?: string;
  isModifier?: boolean;
  highlighted?: boolean;
}) {
  return (
    <kbd
      className={`inline-flex items-center justify-center gap-1 min-w-[22px] h-[22px] px-1.5 rounded-[5px] text-[11.5px] font-mono font-medium tracking-tight select-none transition-all ${
        highlighted
          ? "bg-border-alpha-24 text-text-primary"
          : isModifier
            ? "bg-border-alpha-14 text-text-secondary"
            : "bg-border-alpha-14 text-text-primary"
      }`}
    >
      {symbol && (
        <span
          className={`text-[10.5px] leading-none ${
            highlighted ? "text-text-secondary" : "text-text-tertiary"
          }`}
        >
          {symbol}
        </span>
      )}
      <span className="leading-none">{label}</span>
    </kbd>
  );
}

interface ShortcutRecorderProps {
  shortcut: string;
  defaultShortcut: string;
  enabled: boolean;
  onChange: (shortcut: string) => void;
}

function ShortcutRecorder({
  shortcut,
  defaultShortcut,
  enabled,
  onChange,
}: ShortcutRecorderProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [heldModifiers, setHeldModifiers] = useState<{
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
  }>({ ctrl: false, alt: false, shift: false, meta: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showWarning = (msg: string) => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    setWarning(msg);
    warningTimeoutRef.current = setTimeout(() => setWarning(null), 2500);
  };

  useEffect(() => {
    if (!isRecording) {
      setHeldModifiers({ ctrl: false, alt: false, shift: false, meta: false });
      setWarning(null);
      return;
    }

    const updateModifiersFromEvent = (e: KeyboardEvent) => {
      setHeldModifiers({
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      updateModifiersFromEvent(e);

      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      // Ignore pure modifier key presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      const isFKey = /^F\d{1,2}$/i.test(e.key) || /^F\d{1,2}$/i.test(e.code);

      if (!hasModifier && !isFKey) {
        showWarning(
          t("settings.overlay.shortcut.need_modifier") ||
            "Must include Ctrl, Alt, or Shift"
        );
        return;
      }

      const englishKey = getEnglishKeyFromEvent(e);
      if (!englishKey) {
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
        onChange(normalized);
        setIsRecording(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateModifiersFromEvent(e);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsRecording(false);
      }
    };

    const handleWindowBlur = () => {
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
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [isRecording, onChange, t]);

  const parts = splitShortcutParts(shortcut);
  const isDefault = shortcut === defaultShortcut;

  // Active held modifiers for preview during recording
  const heldPartKeys: string[] = [];
  if (heldModifiers.ctrl) heldPartKeys.push("Control");
  if (heldModifiers.alt) heldPartKeys.push("Alt");
  if (heldModifiers.shift) heldPartKeys.push("Shift");
  if (heldModifiers.meta) heldPartKeys.push("Command");

  return (
    <div ref={containerRef} className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!enabled}
          onClick={() => enabled && setIsRecording((prev) => !prev)}
          className={`group h-[32px] px-2.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-2 border-0 select-none ${
            !enabled
              ? "bg-layer-1 text-text-tertiary cursor-not-allowed opacity-50"
              : isRecording
                ? "bg-border-alpha-20 text-text-primary cursor-pointer"
                : "bg-border-alpha-10 hover:bg-border-alpha-16 text-text-primary cursor-pointer active:scale-[0.99]"
          }`}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
          aria-label={isRecording ? "Recording shortcut" : "Change shortcut"}
        >
          {isRecording ? (
            <div className="flex items-center gap-2">
              {heldPartKeys.length > 0 ? (
                <div className="flex items-center gap-1">
                  {heldPartKeys.map((p) => {
                    const info = getKeyDisplay(p);
                    return (
                      <KeyCap
                        key={p}
                        label={info.label}
                        symbol={info.symbol}
                        isModifier={info.isModifier}
                        highlighted
                      />
                    );
                  })}
                  <span className="text-[11px] text-text-tertiary font-mono">
                    + ...
                  </span>
                </div>
              ) : (
                <span className="text-text-secondary text-[12px]">
                  {t("settings.overlay.shortcut.recording") || "Press keys..."}
                </span>
              )}
              <kbd className="ml-1 text-[10px] text-text-tertiary px-1.5 py-0.5 rounded bg-border-alpha-14 border-0 select-none">
                Esc
              </kbd>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {parts.length > 0 ? (
                parts.map((p, idx) => {
                  const info = getKeyDisplay(p);
                  return (
                    <div key={idx} className="flex items-center gap-1.5">
                      {idx > 0 && (
                        <span className="text-[11px] text-text-quaternary select-none font-medium leading-none">
                          +
                        </span>
                      )}
                      <KeyCap
                        label={info.label}
                        symbol={info.symbol}
                        isModifier={info.isModifier}
                      />
                    </div>
                  );
                })
              ) : (
                <span className="text-text-tertiary">None</span>
              )}
            </div>
          )}
        </button>

        {!isDefault && enabled && !isRecording && (
          <button
            type="button"
            title={
              t("settings.overlay.shortcut.reset") || "Reset to Alt+Shift+O"
            }
            onClick={() => onChange(defaultShortcut)}
            className="flex items-center gap-1 px-2 py-1 h-[28px] rounded-md text-[11.5px] text-text-tertiary hover:text-text-primary hover:bg-border-alpha-10 transition-colors cursor-pointer select-none"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            <Refresh1Line className="w-3.5 h-3.5" />
            <span>{t("settings.overlay.shortcut.reset_label") || "Reset"}</span>
          </button>
        )}
      </div>

      {warning && (
        <span
          className="text-[11px] text-amber-500 font-medium animate-fadeIn select-none"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {warning}
        </span>
      )}
    </div>
  );
}

export function OverlayTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();

  const enabled = useOverlaySettingsStore((s) => s.enabled);
  const setEnabled = useOverlaySettingsStore((s) => s.setEnabled);

  const position = useOverlaySettingsStore((s) => s.position);
  const setPosition = useOverlaySettingsStore((s) => s.setPosition);

  const shortcut = useOverlaySettingsStore((s) => s.shortcut);
  const setShortcut = useOverlaySettingsStore((s) => s.setShortcut);

  const autoShowOnMinimize = useOverlaySettingsStore(
    (s) => s.autoShowOnMinimize
  );
  const setAutoShowOnMinimize = useOverlaySettingsStore(
    (s) => s.setAutoShowOnMinimize
  );

  const alwaysOnTop = useOverlaySettingsStore((s) => s.alwaysOnTop);
  const setAlwaysOnTop = useOverlaySettingsStore((s) => s.setAlwaysOnTop);

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
            <ShortcutRecorder
              shortcut={shortcut}
              defaultShortcut={DEFAULT_SHORTCUT}
              enabled={enabled}
              onChange={setShortcut}
            />
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
