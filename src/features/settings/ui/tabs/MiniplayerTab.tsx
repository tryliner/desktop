import { useState, useEffect } from "react";
import { useTranslation } from "@/languages";
import { useMiniPlayerSettingsStore } from "@/features/touchbar";
import { useCustomizationStore } from "@/features/settings";
import { ToggleSwitch, Button } from "@/shared/ui";
import { SettingRow, SettingSection } from "../controls";

export function MiniplayerTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  const autoShowOnMinimize = useMiniPlayerSettingsStore((s) => s.autoShowOnMinimize);
  const setAutoShowOnMinimize = useMiniPlayerSettingsStore((s) => s.setAutoShowOnMinimize);

  const showTimeline = useMiniPlayerSettingsStore((s) => s.showTimeline);
  const setShowTimeline = useMiniPlayerSettingsStore((s) => s.setShowTimeline);

  const closeOnRestore = useMiniPlayerSettingsStore((s) => s.closeOnRestore);
  const setCloseOnRestore = useMiniPlayerSettingsStore((s) => s.setCloseOnRestore);

  const alwaysOnTop = useMiniPlayerSettingsStore((s) => s.alwaysOnTop);
  const setAlwaysOnTop = useMiniPlayerSettingsStore((s) => s.setAlwaysOnTop);

  const applyCustomBackground = useMiniPlayerSettingsStore((s) => s.applyCustomBackground);
  const setApplyCustomBackground = useMiniPlayerSettingsStore((s) => s.setApplyCustomBackground);

  const backgroundImage = useCustomizationStore((s) => s.backgroundImage);

  const handleToggleSimulator = () => {
    window.linerElectron?.toggleTouchBarSimulator?.();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.miniplayer.auto_show_on_minimize.title")}
        description={t("settings.miniplayer.auto_show_on_minimize.description")}
        titleKey="settings.miniplayer.auto_show_on_minimize.title"
        descKey="settings.miniplayer.auto_show_on_minimize.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={autoShowOnMinimize}
            onChange={setAutoShowOnMinimize}
          />
        }
      />

      <SettingRow
        title={t("settings.miniplayer.show_timeline.title")}
        description={t("settings.miniplayer.show_timeline.description")}
        titleKey="settings.miniplayer.show_timeline.title"
        descKey="settings.miniplayer.show_timeline.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={showTimeline}
            onChange={setShowTimeline}
          />
        }
      />

      <SettingRow
        title={t("settings.miniplayer.close_on_restore.title")}
        description={t("settings.miniplayer.close_on_restore.description")}
        titleKey="settings.miniplayer.close_on_restore.title"
        descKey="settings.miniplayer.close_on_restore.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={closeOnRestore}
            onChange={setCloseOnRestore}
          />
        }
      />

      <SettingRow
        title={t("settings.miniplayer.always_on_top.title")}
        description={t("settings.miniplayer.always_on_top.description")}
        titleKey="settings.miniplayer.always_on_top.title"
        descKey="settings.miniplayer.always_on_top.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={alwaysOnTop}
            onChange={setAlwaysOnTop}
          />
        }
      />

      <SettingRow
        title={t("settings.miniplayer.custom_background.title")}
        description={
          backgroundImage
            ? t("settings.miniplayer.custom_background.description")
            : t("settings.miniplayer.custom_background.no_wallpaper_description")
        }
        titleKey="settings.miniplayer.custom_background.title"
        descKey="settings.miniplayer.custom_background.description"
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={applyCustomBackground}
            onChange={setApplyCustomBackground}
          />
        }
      />

      <SettingRow
        title={t("settings.miniplayer.test_toggle.title")}
        description={t("settings.miniplayer.test_toggle.description")}
        titleKey="settings.miniplayer.test_toggle.title"
        descKey="settings.miniplayer.test_toggle.description"
        searchQuery={searchQuery}
        control={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleSimulator}
          >
            {t("settings.miniplayer.test_toggle.button")}
          </Button>
        }
      />

      <SettingRow
        title={t("settings.miniplayer.hotkeys.title")}
        description={t("settings.miniplayer.hotkeys.description")}
        titleKey="settings.miniplayer.hotkeys.title"
        descKey="settings.miniplayer.hotkeys.description"
        searchQuery={searchQuery}
      />
    </SettingSection>
  );
}
