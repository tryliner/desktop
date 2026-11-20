import { usePlayerStore } from "@/features/player";
import { ToggleSwitch } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { SettingRow, SettingSection } from "../../controls";
import { CrossfadeLength } from "./CrossfadeLength";

export function TransitionsSection({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const crossfadeSeconds = usePlayerStore((state) => state.crossfadeSeconds);
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

  return (
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
        <CrossfadeLength />
      </SettingRow>
      <SettingRow
        title={t("settings.transitions.automix.title")}
        description={t("settings.transitions.automix.description")}
        titleKey="settings.transitions.automix.title"
        descKey="settings.transitions.automix.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            ariaLabel={t("settings.transitions.automix.title")}
            checked={automix}
            onChange={setAutomix}
          />
        }
      />
      <SettingRow
        title={t("settings.transitions.gapless.title")}
        description={t("settings.transitions.gapless.description")}
        titleKey="settings.transitions.gapless.title"
        descKey="settings.transitions.gapless.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            ariaLabel={t("settings.transitions.gapless.title")}
            checked={gapless}
            onChange={setGapless}
          />
        }
      />
      <SettingRow
        title={t("settings.transitions.on_skip.title")}
        description={t("settings.transitions.on_skip.description")}
        titleKey="settings.transitions.on_skip.title"
        descKey="settings.transitions.on_skip.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            ariaLabel={t("settings.transitions.on_skip.title")}
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
            ariaLabel={t("settings.transitions.normalize.title")}
            checked={normalizeVolume}
            onChange={setNormalizeVolume}
          />
        }
      />
    </SettingSection>
  );
}
