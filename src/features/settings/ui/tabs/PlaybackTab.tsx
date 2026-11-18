import { useState, useEffect } from "react";
import { useTranslation } from "@/languages";
import { usePlayerStore } from "@/features/player";
import { Slider, ToggleSwitch } from "@/shared/ui";
import {
  SettingBlock,
  SettingRow,
  SettingSection,
  SegmentedControl,
} from "../controls";

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
  const setCrossfadeSeconds = usePlayerStore(
    (state) => state.setCrossfadeSeconds,
  );
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
        <SettingBlock
          title={t("settings.transitions.crossfade.title")}
          description={t("settings.transitions.crossfade.description")}
          titleKey="settings.transitions.crossfade.title"
          descKey="settings.transitions.crossfade.description"
          searchQuery={searchQuery}
        >
          <Slider
            ariaLabel={t("settings.transitions.crossfade.title")}
            value={crossfadeSeconds}
            min={0}
            max={12}
            step={1}
            formatValue={(value) =>
              value === 0
                ? t("settings.transitions.crossfade.off")
                : t("settings.transitions.crossfade.seconds", { count: value })
            }
            onChange={setCrossfadeSeconds}
          />
        </SettingBlock>
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
              disabled={crossfadeSeconds === 0}
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
