import { ToggleSwitch } from "@/shared/ui";
import {
  useLyricsPopupPreferencesStore,
  type LyricsPopupPreferences,
} from "@/features/lyrics/store/lyricsPopupPreferencesStore";
import { useTranslation } from "@/languages";
import { SettingRow, SettingSection } from "../controls";

function RangeControl({
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex w-[190px] items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full accent-white"
      />
      <span className="w-[38px] shrink-0 text-right text-caption tabular-nums text-text-tertiary">
        {Math.round(value * (max <= 1 ? 100 : 1))}{max <= 1 ? "%" : unit}
      </span>
    </label>
  );
}

export function LyricsPopupTab({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const { t } = useTranslation();
  const preferences = useLyricsPopupPreferencesStore();
  const update = preferences.updatePreference;
  const title = (key: string, fallback: string) =>
    t(`settings.lyrics_popup.${key}`) || fallback;
  const row = <K extends keyof LyricsPopupPreferences>(
    key: K,
    fallback: string,
    control: React.ReactNode,
  ) => (
    <SettingRow
      title={title(key, fallback)}
      titleKey={`settings.lyrics_popup.${key}`}
      searchQuery={searchQuery}
      control={control}
    />
  );

  return (
    <div className="flex flex-col gap-[12px]">
      <SettingSection label={title("lyrics_section", "Lyrics across Liner")}>
        {row(
          "useCustomLyricsColor",
          "Use custom lyric color",
          <ToggleSwitch
            checked={preferences.useCustomLyricsColor}
            onChange={(value) => update("useCustomLyricsColor", value)}
          />,
        )}
        {preferences.useCustomLyricsColor &&
          row(
            "lyricsColor",
            "Lyric color",
            <input
              type="color"
              aria-label="Lyric color"
              value={preferences.lyricsColor}
              onChange={(event) =>
                update("lyricsColor", event.currentTarget.value)
              }
              className="h-8 w-10 cursor-pointer rounded-md border border-border-primary bg-transparent p-1"
            />,
          )}
        {row(
          "textGlow",
          "Lyric glow",
          <ToggleSwitch
            checked={preferences.textGlow}
            onChange={(value) => update("textGlow", value)}
          />,
        )}
        {preferences.textGlow &&
          row(
            "glowSize",
            "Glow strength",
            <RangeControl
              value={preferences.glowSize}
              min={0}
              max={36}
              step={1}
              unit="px"
              onChange={(value) => update("glowSize", value)}
            />,
          )}
      </SettingSection>

      <SettingSection label={title("background_section", "Pop-up appearance")}>
        {row(
          "lyricsOnly",
          "Transparent lyrics only",
          <ToggleSwitch
            checked={preferences.lyricsOnly}
            onChange={(value) => update("lyricsOnly", value)}
          />,
        )}
        {row(
          "showBackground",
          "Artwork background",
          <ToggleSwitch
            checked={preferences.showBackground}
            onChange={(value) => update("showBackground", value)}
          />,
        )}
        {preferences.showBackground &&
          row(
            "backgroundDim",
            "Background dim",
            <RangeControl
              value={preferences.backgroundDim}
              min={0.1}
              max={0.85}
              step={0.05}
              onChange={(value) => update("backgroundDim", value)}
            />,
          )}
        {row(
          "lyricsOpacity",
          "Lyrics opacity",
          <RangeControl
            value={preferences.lyricsOpacity}
            min={0.35}
            max={1}
            step={0.05}
            onChange={(value) => update("lyricsOpacity", value)}
          />,
        )}
        {row(
          "textShadow",
          "Text shadow",
          <ToggleSwitch
            checked={preferences.textShadow}
            onChange={(value) => update("textShadow", value)}
          />,
        )}
        {preferences.textShadow &&
          row(
            "shadowSize",
            "Shadow strength",
            <RangeControl
              value={preferences.shadowSize}
              min={0}
              max={48}
              step={1}
              unit="px"
              onChange={(value) => update("shadowSize", value)}
            />,
          )}
      </SettingSection>

      <SettingSection label={title("window_section", "Pop-up window")}>
        {!preferences.lyricsOnly &&
          row(
            "windowShadow",
            "Pop-up window shadow",
            <ToggleSwitch
              checked={preferences.windowShadow}
              onChange={(value) => update("windowShadow", value)}
            />,
          )}
      </SettingSection>

      <SettingSection label={title("topbar_section", "Pop-up top bar")}>
        {row(
          "autoHideControls",
          "Auto-hide controls after 3 seconds",
          <ToggleSwitch
            checked={preferences.autoHideControls}
            onChange={(value) => update("autoHideControls", value)}
          />,
        )}
        {row(
          "showSpeedPitchButton",
          "Show speed & pitch button",
          <ToggleSwitch
            checked={preferences.showSpeedPitchButton}
            onChange={(value) => update("showSpeedPitchButton", value)}
          />,
        )}
        {row(
          "showEqualizerButton",
          "Show equalizer button",
          <ToggleSwitch
            checked={preferences.showEqualizerButton}
            onChange={(value) => update("showEqualizerButton", value)}
          />,
        )}
      </SettingSection>
    </div>
  );
}
