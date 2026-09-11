import { useState, useEffect } from "react";
import { useTranslation } from "@/languages";
import { usePlayerStore, type AudioQuality } from "@/features/player";
import { ToggleSwitch, Select } from "@/shared/ui";
import { SettingRow, SettingSection } from "../controls";

export function AudioTab() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const pauseOnDeviceChange = usePlayerStore(
    (state) => state.pauseOnDeviceChange,
  );
  const setPauseOnDeviceChange = usePlayerStore(
    (state) => state.setPauseOnDeviceChange,
  );
  const audioQuality = usePlayerStore((state) => state.audioQuality);
  const setAudioQuality = usePlayerStore((state) => state.setAudioQuality);

  useEffect(() => {
    setMounted(true);
  }, []);

  // lossless is listed as unavailable, so the picker only offers live tiers
  const quality: Exclude<AudioQuality, "lossless"> =
    audioQuality === "lossless" ? "high" : audioQuality;

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.audio.title")}
        description={t("settings.audio.description")}
        control={
          mounted ? (
            <Select
              aria-label={t("settings.audio.title")}
              className="w-[210px]"
              value={quality}
              onChange={setAudioQuality}
              options={[
                { value: "low", label: t("settings.audio.low") },
                { value: "standard", label: t("settings.audio.standard") },
                { value: "high", label: t("settings.audio.high") },
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
        control={
          <ToggleSwitch
            checked={pauseOnDeviceChange}
            onChange={setPauseOnDeviceChange}
          />
        }
      />
    </SettingSection>
  );
}
