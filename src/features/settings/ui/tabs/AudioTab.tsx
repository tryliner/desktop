import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "@/languages";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { EqualizerControls } from "@/features/player/ui/EqualizerControls";
import { Slider, ToggleSwitch } from "@/shared/ui";
import { SettingBlock, SettingRow, SettingSection } from "../controls";

const resetClass =
  "rounded-[8px] px-[12px] py-[6px] text-[12px] text-text-primary bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.12] border-0 cursor-pointer";

export function AudioTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const state = usePlayerStore(
    useShallow((state) => ({
      isEqualizerEnabled: state.isEqualizerEnabled,
      isEnhancerEnabled: state.isEnhancerEnabled,
      enhancementEngine: state.enhancementEngine,
      enhancementPreset: state.enhancementPreset,
      vocalClarity: state.vocalClarity,
      highEndAir: state.highEndAir,
      bassDepth: state.bassDepth,
      setIsEqualizerEnabled: state.setIsEqualizerEnabled,
      setIsEnhancerEnabled: state.setIsEnhancerEnabled,
      setEnhancementEngine: state.setEnhancementEngine,
      setEnhancementPreset: state.setEnhancementPreset,
      setVocalClarity: state.setVocalClarity,
      setHighEndAir: state.setHighEndAir,
      setBassDepth: state.setBassDepth,
      resetAudioEffects: state.resetAudioEffects,
    })),
  );

  return (
    <div className="flex flex-col gap-[20px]">
      <SettingSection>
        <SettingRow
          title={t("settings.audio.enhancer.title")}
          description={t("settings.audio.enhancer.description")}
          titleKey="settings.audio.enhancer.title"
          descKey="settings.audio.enhancer.description"
          explained
          searchQuery={searchQuery}
          control={
            <div className="flex items-center gap-[10px]">
              <span className="rounded-[4px] bg-black/[0.08] px-[5px] py-[2px] text-[9px] font-bold leading-none tracking-[0.04em] text-text-secondary dark:bg-white/[0.12]">
                BETA
              </span>
              <ToggleSwitch
                ariaLabel={t("settings.audio.enhancer.title")}
                checked={state.isEnhancerEnabled}
                onChange={state.setIsEnhancerEnabled}
              />
            </div>
          }
        />
        <SettingBlock
          title={t("settings.audio.enhancer.engine_label")}
          description={t("settings.audio.enhancer.engine_description")}
          titleKey="settings.audio.enhancer.engine_label"
          descKey="settings.audio.enhancer.engine_description"
          searchQuery={searchQuery}
        >
          <select
            aria-label={t("settings.audio.enhancer.engine_label")}
            value={state.enhancementEngine}
            onChange={(event) =>
              state.setEnhancementEngine(event.target.value as typeof state.enhancementEngine)
            }
            className="h-[38px] w-full rounded-[9px] border-0 bg-black/[0.06] px-[12px] text-[13px] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-text-primary/30 dark:bg-white/[0.08]"
          >
            <option value="hqmusic-3">
              {t("settings.audio.enhancer.engines.hqmusic_3")}
            </option>
            <option value="glyphs-7B">
              {t("settings.audio.enhancer.engines.glyphs_7b")}
            </option>
            <option value="fyro1.1">
              {t("settings.audio.enhancer.engines.fyro_1_1")}
            </option>
          </select>
        </SettingBlock>
        <SettingBlock
          title={t("settings.audio.enhancer.presets.title")}
          description={t("settings.audio.enhancer.presets.description")}
          titleKey="settings.audio.enhancer.presets.title"
          descKey="settings.audio.enhancer.presets.description"
          searchQuery={searchQuery}
        >
          <div className="flex flex-wrap gap-[8px]">
            {(["studio", "vinyl", "concert"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={state.enhancementPreset === preset}
                onClick={() => state.setEnhancementPreset(preset)}
                className={`rounded-full border-0 px-[12px] py-[7px] text-[12px] transition-colors ${
                  state.enhancementPreset === preset
                    ? "bg-text-primary text-bg-primary"
                    : "bg-black/[0.06] text-text-secondary hover:text-text-primary dark:bg-white/[0.08]"
                }`}
              >
                {t(`settings.audio.enhancer.presets.${preset}`)}
              </button>
            ))}
          </div>
        </SettingBlock>
        <SettingBlock
          title={t("settings.audio.vocal_clarity.title")}
          description={t("settings.audio.vocal_clarity.description")}
          titleKey="settings.audio.vocal_clarity.title"
          descKey="settings.audio.vocal_clarity.description"
          searchQuery={searchQuery}
        >
          <Slider
            ariaLabel={t("settings.audio.vocal_clarity.title")}
            value={state.vocalClarity}
            onChange={state.setVocalClarity}
            min={-50}
            max={50}
            step={1}
            disabled={!state.isEnhancerEnabled}
            unit="%"
            formatValue={(value) => `${value > 0 ? "+" : ""}${value}%`}
          />
        </SettingBlock>
        <SettingBlock
          title={t("settings.audio.high_end_air.title")}
          description={t("settings.audio.high_end_air.description")}
          titleKey="settings.audio.high_end_air.title"
          descKey="settings.audio.high_end_air.description"
          searchQuery={searchQuery}
        >
          <Slider
            ariaLabel={t("settings.audio.high_end_air.title")}
            value={state.highEndAir}
            onChange={state.setHighEndAir}
            min={-50}
            max={50}
            step={1}
            disabled={!state.isEnhancerEnabled}
            unit="%"
            formatValue={(value) => `${value > 0 ? "+" : ""}${value}%`}
          />
        </SettingBlock>
        <SettingBlock
          title={t("settings.audio.bass_depth.title")}
          description={t("settings.audio.bass_depth.description")}
          titleKey="settings.audio.bass_depth.title"
          descKey="settings.audio.bass_depth.description"
          searchQuery={searchQuery}
        >
          <Slider
            ariaLabel={t("settings.audio.bass_depth.title")}
            value={state.bassDepth}
            onChange={state.setBassDepth}
            min={-50}
            max={50}
            step={1}
            disabled={!state.isEnhancerEnabled}
            unit="%"
            formatValue={(value) => `${value > 0 ? "+" : ""}${value}%`}
          />
        </SettingBlock>
      </SettingSection>

      <SettingSection>
        <SettingRow
          title={t("settings.audio.equalizer.title")}
          description={t("settings.audio.equalizer.description")}
          titleKey="settings.audio.equalizer.title"
          descKey="settings.audio.equalizer.description"
          explained
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              ariaLabel={t("settings.audio.equalizer.title")}
              checked={state.isEqualizerEnabled}
              onChange={state.setIsEqualizerEnabled}
            />
          }
        />
        <SettingBlock
          title={t("settings.audio.equalizer.bands_title")}
          description={t("settings.audio.equalizer.bands_description")}
          titleKey="settings.audio.equalizer.bands_title"
          descKey="settings.audio.equalizer.bands_description"
          searchQuery={searchQuery}
        >
          <EqualizerControls />
        </SettingBlock>
      </SettingSection>

      <SettingBlock
        title={t("settings.audio.reset.title")}
        description={t("settings.audio.reset.description")}
        titleKey="settings.audio.reset.title"
        descKey="settings.audio.reset.description"
        searchQuery={searchQuery}
      >
        <button
          type="button"
          className={`${resetClass} self-start`}
          onClick={state.resetAudioEffects}
        >
          {t("settings.audio.reset.title")}
        </button>
      </SettingBlock>
    </div>
  );
}
