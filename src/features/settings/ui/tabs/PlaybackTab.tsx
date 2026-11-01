import { useState, useEffect } from "react";
import { useTranslation } from "@/languages";
import { usePlayerStore } from "@/features/player";
import { useVisualizerStore, type VisualizerMode } from "@/features/visualizer";
import { ToggleSwitch } from "@/shared/ui";
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
  const isNormalizerEnabled = usePlayerStore(
    (state) => state.isNormalizerEnabled,
  );
  const setIsNormalizerEnabled = usePlayerStore(
    (state) => state.setIsNormalizerEnabled,
  );
  const crossfeedMode = usePlayerStore((state) => state.crossfeedMode);
  const setCrossfeedMode = usePlayerStore((state) => state.setCrossfeedMode);
  const crossfadeMs = usePlayerStore((state) => state.crossfadeMs);
  const setCrossfadeMs = usePlayerStore((state) => state.setCrossfadeMs);
  const visualizerMode = useVisualizerStore((state) => state.mode);
  const setVisualizerMode = useVisualizerStore((state) => state.setMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
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

      <SettingRow
        title={
          !t("settings.audio.normalizer.title") || t("settings.audio.normalizer.title").startsWith("settings.")
            ? "Loudness Normalization"
            : t("settings.audio.normalizer.title")
        }
        description={
          !t("settings.audio.normalizer.description") || t("settings.audio.normalizer.description").startsWith("settings.")
            ? "Equalize track volume using EBU R128 dynamic range compression"
            : t("settings.audio.normalizer.description")
        }
        titleKey="settings.audio.normalizer.title"
        descKey="settings.audio.normalizer.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={isNormalizerEnabled}
            onChange={setIsNormalizerEnabled}
          />
        }
      />

      <SettingRow
        title={
          !t("settings.audio.crossfade.title") ||
          t("settings.audio.crossfade.title").startsWith("settings.")
            ? "Crossfade"
            : t("settings.audio.crossfade.title")
        }
        description={
          !t("settings.audio.crossfade.description") ||
          t("settings.audio.crossfade.description").startsWith("settings.")
            ? "Fade the current track out and the next one in when a song ends"
            : t("settings.audio.crossfade.description")
        }
        titleKey="settings.audio.crossfade.title"
        descKey="settings.audio.crossfade.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <SegmentedControl
              ariaLabel="Crossfade"
              value={String(crossfadeMs)}
              onChange={(next) => setCrossfadeMs(Number(next))}
              options={[
                { value: "0", label: "Off" },
                { value: "3000", label: "3s" },
                { value: "6000", label: "6s" },
                { value: "9000", label: "9s" },
              ]}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title={
          !t("settings.audio.crossfeed.title") || t("settings.audio.crossfeed.title").startsWith("settings.")
            ? "Spatial Audio (Dolby Atmos 3D)"
            : t("settings.audio.crossfeed.title")
        }
        description={
          !t("settings.audio.crossfeed.description") || t("settings.audio.crossfeed.description").startsWith("settings.")
            ? "Simulate 3D immersive surround soundstage with height elevation, out-of-head acoustics, and Dolby Atmos cinema dimension on headphones"
            : t("settings.audio.crossfeed.description")
        }
        titleKey="settings.audio.crossfeed.title"
        descKey="settings.audio.crossfeed.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <SegmentedControl
              ariaLabel="Spatial Audio (Dolby Atmos 3D)"
              value={crossfeedMode}
              onChange={setCrossfeedMode}
              options={[
                { value: "off", label: "Off" },
                { value: "subtle", label: "Studio" },
                { value: "standard", label: "Dolby Atmos 3D" },
                { value: "wide", label: "Cinema Hall" },
              ]}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingRow
        title={
          !t("settings.audio.visualizer.title") || t("settings.audio.visualizer.title").startsWith("settings.")
            ? "Audio Spectrum Visualizer"
            : t("settings.audio.visualizer.title")
        }
        description={
          !t("settings.audio.visualizer.description") || t("settings.audio.visualizer.description").startsWith("settings.")
            ? "Display dynamic 60/120fps audio frequency spectrum visualizer in full player"
            : t("settings.audio.visualizer.description")
        }
        titleKey="settings.audio.visualizer.title"
        descKey="settings.audio.visualizer.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <SegmentedControl
              ariaLabel="Audio Spectrum Visualizer"
              value={visualizerMode}
              onChange={(val) => setVisualizerMode(val as VisualizerMode)}
              options={[
                { value: "off", label: "Off" },
                { value: "bars", label: "Bars" },
                { value: "wave", label: "Wave" },
              ]}
            />
          ) : (
            <span />
          )
        }
      />
    </SettingSection>
  );
}
