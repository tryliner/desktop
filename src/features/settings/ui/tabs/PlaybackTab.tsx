import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/languages";
import { MAX_CROSSFADE_SECONDS, usePlayerStore } from "@/features/player";
import { Slider, ToggleSwitch } from "@/shared/ui";
import { SettingRow, SettingSection, SegmentedControl } from "../controls";

export function PlaybackTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const autoplaySimilar = usePlayerStore((state) => state.autoplaySimilar);
  const setAutoplaySimilar = usePlayerStore(
    (state) => state.setAutoplaySimilar,
  );
  const trackDoubleClickBehavior = usePlayerStore(
    (state) => state.trackDoubleClickBehavior,
  );
  const setTrackDoubleClickBehavior = usePlayerStore(
    (state) => state.setTrackDoubleClickBehavior,
  );
  const defaultPlaybackContext = usePlayerStore(
    (state) => state.defaultPlaybackContext,
  );
  const setDefaultPlaybackContext = usePlayerStore(
    (state) => state.setDefaultPlaybackContext,
  );
  const pauseOnDeviceChange = usePlayerStore(
    (state) => state.pauseOnDeviceChange,
  );
  const setPauseOnDeviceChange = usePlayerStore(
    (state) => state.setPauseOnDeviceChange,
  );

  const crossfadeSeconds = usePlayerStore((state) => state.crossfadeSeconds);
  const crossfadeLength = usePlayerStore((state) => state.crossfadeLength);
  const setCrossfadeSeconds = usePlayerStore(
    (state) => state.setCrossfadeSeconds,
  );
  const setCrossfadeEnabled = usePlayerStore(
    (state) => state.setCrossfadeEnabled,
  );
  const crossfadeOn = crossfadeSeconds > 0;
  const gapless = usePlayerStore((state) => state.gapless);
  const setGapless = usePlayerStore((state) => state.setGapless);
  const automix = usePlayerStore((state) => state.automix);
  const setAutomix = usePlayerStore((state) => state.setAutomix);
  const crossfadeOnSkip = usePlayerStore((state) => state.crossfadeOnSkip);
  const setCrossfadeOnSkip = usePlayerStore(
    (state) => state.setCrossfadeOnSkip,
  );
  const normalizeVolume = usePlayerStore((state) => state.normalizeVolume);
  const setNormalizeVolume = usePlayerStore(
    (state) => state.setNormalizeVolume,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col gap-[20px]">
      <SettingSection label={t("settings.transitions.section")}>
        <SettingRow
          title={t("settings.transitions.crossfade.title")}
          description={
            crossfadeOn
              ? t("settings.transitions.crossfade.description_on", {
                  count: crossfadeSeconds,
                })
              : t("settings.transitions.crossfade.description")
          }
          titleKey="settings.transitions.crossfade.title"
          descKey="settings.transitions.crossfade.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              ariaLabel={t("settings.transitions.crossfade.title")}
              checked={crossfadeOn}
              onChange={setCrossfadeEnabled}
            />
          }
        >
          <AnimatePresence initial={false}>
            {crossfadeOn && (
              <motion.div
                key="crossfade-length"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="px-[16px] pb-[12px]">
                  <div className="flex items-center gap-[10px] rounded-item bg-fill-subtle py-[8px] pl-[12px] pr-[10px]">
                    <span className="w-[38px] shrink-0 text-caption font-[500] text-text-tertiary">
                      {t("settings.transitions.crossfade.shorter")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Slider
                        ariaLabel={t("settings.transitions.crossfade.length")}
                        ariaValueText={t(
                          "settings.transitions.crossfade.seconds",
                          { count: crossfadeLength },
                        )}
                        value={crossfadeLength}
                        min={1}
                        max={MAX_CROSSFADE_SECONDS}
                        step={1}
                        thumb
                        marks={Array.from(
                          { length: MAX_CROSSFADE_SECONDS },
                          (_, i) => i + 1,
                        )}
                        showValue={false}
                        onChange={setCrossfadeSeconds}
                      />
                    </div>
                    <span className="w-[30px] shrink-0 text-caption font-[500] text-text-tertiary">
                      {t("settings.transitions.crossfade.longer")}
                    </span>
                    <span className="min-w-[40px] shrink-0 rounded-full bg-fill px-[8px] py-[3px] text-center text-caption font-[600] tabular-nums text-text-primary">
                      {t("settings.transitions.crossfade.short", {
                        count: crossfadeLength,
                      })}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SettingRow>
        <SettingRow
          title={t("settings.transitions.automix.title")}
          description={t("settings.transitions.automix.description")}
          titleKey="settings.transitions.automix.title"
          descKey="settings.transitions.automix.description"
          searchQuery={searchQuery}
          control={<ToggleSwitch checked={automix} onChange={setAutomix} />}
        />
        <SettingRow
          title={t("settings.transitions.gapless.title")}
          description={t("settings.transitions.gapless.description")}
          titleKey="settings.transitions.gapless.title"
          descKey="settings.transitions.gapless.description"
          searchQuery={searchQuery}
          control={<ToggleSwitch checked={gapless} onChange={setGapless} />}
        />
        <SettingRow
          title={t("settings.transitions.on_skip.title")}
          description={t("settings.transitions.on_skip.description")}
          titleKey="settings.transitions.on_skip.title"
          descKey="settings.transitions.on_skip.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={crossfadeOnSkip}
              disabled={!crossfadeOn}
              onChange={setCrossfadeOnSkip}
            />
          }
        />
        <SettingRow
          title={t("settings.transitions.normalize.title")}
          description={t("settings.transitions.normalize.description")}
          titleKey="settings.transitions.normalize.title"
          descKey="settings.transitions.normalize.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={normalizeVolume}
              onChange={setNormalizeVolume}
            />
          }
        />
      </SettingSection>

      <SettingSection>
        <SettingRow
          title={t("settings.autoplay_similar.title")}
          description={t("settings.autoplay_similar.description")}
          titleKey="settings.autoplay_similar.title"
          descKey="settings.autoplay_similar.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={autoplaySimilar}
              onChange={setAutoplaySimilar}
            />
          }
        />

        <SettingRow
          title={t("settings.track_double_click.title")}
          description={t("settings.track_double_click.description")}
          titleKey="settings.track_double_click.title"
          descKey="settings.track_double_click.description"
          searchQuery={searchQuery}
          control={
            mounted ? (
              <SegmentedControl
                ariaLabel={t("settings.track_double_click.title")}
                value={trackDoubleClickBehavior}
                onChange={setTrackDoubleClickBehavior}
                options={[
                  {
                    value: "play",
                    label: t("settings.track_double_click.play"),
                  },
                  {
                    value: "queue",
                    label: t("settings.track_double_click.queue"),
                  },
                ]}
              />
            ) : (
              <span />
            )
          }
        />

        <SettingRow
          title={t("settings.default_playback_context.title")}
          description={t("settings.default_playback_context.description")}
          explained
          titleKey="settings.default_playback_context.title"
          descKey="settings.default_playback_context.description"
          searchQuery={searchQuery}
          control={
            mounted ? (
              <SegmentedControl
                ariaLabel={t("settings.default_playback_context.title")}
                value={defaultPlaybackContext}
                onChange={setDefaultPlaybackContext}
                options={[
                  {
                    value: "resume",
                    label: t("settings.default_playback_context.resume"),
                  },
                  {
                    value: "empty",
                    label: t("settings.default_playback_context.empty"),
                  },
                ]}
              />
            ) : (
              <span />
            )
          }
        />

        <SettingRow
          title={t("settings.audio.pause_on_device_change.title")}
          description={t("settings.audio.pause_on_device_change.description")}
          titleKey="settings.audio.pause_on_device_change.title"
          descKey="settings.audio.pause_on_device_change.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={pauseOnDeviceChange}
              onChange={setPauseOnDeviceChange}
            />
          }
        />
      </SettingSection>
    </div>
  );
}
