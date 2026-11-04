import { useTranslation } from "@/languages";
import { MAX_CROSSFADE_SECONDS, usePlayerStore } from "@/features/player";
import { Slider } from "@/shared/ui";
import { SettingRow } from "../controls";

export interface CrossfadeSettingProps {
  searchQuery?: string;
}

export function CrossfadeSetting({ searchQuery }: CrossfadeSettingProps) {
  const { t } = useTranslation();
  const crossfadeSeconds = usePlayerStore((state) => state.crossfadeSeconds);
  const setCrossfadeSeconds = usePlayerStore(
    (state) => state.setCrossfadeSeconds,
  );

  return (
    <SettingRow
      title={t("settings.crossfade.title")}
      description={t("settings.crossfade.description")}
      titleKey="settings.crossfade.title"
      descKey="settings.crossfade.description"
      searchQuery={searchQuery}
      control={
        <Slider
          className="w-40"
          ariaLabel={t("settings.crossfade.title")}
          value={crossfadeSeconds}
          onChange={setCrossfadeSeconds}
          min={0}
          max={MAX_CROSSFADE_SECONDS}
          step={1}
          formatValue={(seconds) =>
            seconds === 0 ? t("settings.crossfade.off") : `${seconds}s`
          }
        />
      }
    />
  );
}
