import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import { MenuSelect, ToggleSwitch } from "@/shared/ui";
import { revealThemeChange } from "@/shared/lib";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import { ThemeCard } from "./ThemeCard";

export function AppearanceTab({ searchQuery }: { searchQuery?: string }) {
  const { t, locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const electron = typeof window !== "undefined" ? window.linerElectron : null;
  const [rememberWindowBounds, setRememberWindowBounds] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    electron
      ?.getRememberWindowBounds?.()
      .then((enabled) => {
        if (!cancelled) setRememberWindowBounds(enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [electron]);

  const changeRememberWindowBounds = (enabled: boolean) => {
    setRememberWindowBounds(enabled);
    electron
      ?.setRememberWindowBounds?.(enabled)
      .then(setRememberWindowBounds)
      .catch(() => setRememberWindowBounds(!enabled));
  };

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.language.label")}
        description={t("settings.language.description")}
        titleKey="settings.language.label"
        descKey="settings.language.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <MenuSelect
              options={LOCALE_OPTIONS}
              value={locale}
              onChange={setLocale}
              className="min-w-[130px]"
              aria-label={t("settings.language.label")}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingBlock
        title={t("settings.theme.title")}
        description={t("settings.theme.description")}
        titleKey="settings.theme.title"
        descKey="settings.theme.description"
        searchQuery={searchQuery}
      >
        {mounted ? (
          <div className="grid grid-cols-3 gap-[10px]">
            {(
              [
                { value: "system", label: t("settings.theme.system") },
                { value: "light", label: t("settings.theme.light") },
                { value: "dark", label: t("settings.theme.dark") },
              ] as const
            ).map((item) => {
              return (
                <ThemeCard
                  key={item.value}
                  mode={item.value}
                  label={item.label}
                  active={theme === item.value}
                  onSelect={(event) =>
                    revealThemeChange(() => setTheme(item.value), {
                      x: event.clientX,
                      y: event.clientY,
                    })
                  }
                />
              );
            })}
          </div>
        ) : null}
      </SettingBlock>

      {electron?.setRememberWindowBounds ? (
        <SettingRow
          title={t("settings.remember_window_bounds.title")}
          description={t("settings.remember_window_bounds.description")}
          titleKey="settings.remember_window_bounds.title"
          descKey="settings.remember_window_bounds.description"
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={rememberWindowBounds}
              onChange={changeRememberWindowBounds}
            />
          }
        />
      ) : null}
    </SettingSection>
  );
}
