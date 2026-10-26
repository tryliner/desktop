import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import { MenuSelect, ToggleSwitch } from "@/shared/ui";
import { revealThemeChange } from "@/shared/lib";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import { ThemeCard } from "./ThemeCard";
import { useCustomizationStore, useIsDarkTheme } from "../../store/customizationStore";

export function AppearanceTab({ searchQuery }: { searchQuery?: string }) {
  const { t, locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const coverGlow = useCustomizationStore((s) => s.coverGlow);
  const isDarkTheme = useIsDarkTheme();
  const glowLocked = !isDarkTheme;
  const setCoverGlow = useCustomizationStore((s) => s.setCoverGlow);

  useEffect(() => {
    setMounted(true);
  }, []);

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

      <SettingRow
        title={t("settings.cover_glow.title") || "Cover glow"}
        description={
          !isDarkTheme
            ? t("settings.cover_glow.disabled_for_light") || "Off in light theme."
            : t("settings.cover_glow.description") ||
              "Blurred artwork glow behind pages. Turn off to keep a plain background."
        }
        titleKey="settings.cover_glow.title"
        descKey={glowLocked ? undefined : "settings.cover_glow.description"}
        searchQuery={searchQuery}
        control={
          <ToggleSwitch
            checked={coverGlow && !glowLocked}
            onChange={setCoverGlow}
            disabled={glowLocked}
            ariaLabel={t("settings.cover_glow.title") || "Cover glow"}
          />
        }
      />
    </SettingSection>
  );
}
