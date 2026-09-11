import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  usePlayerStore,
  type AccentVariant,
} from "@/features/player";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import { Select } from "@/shared/ui";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import defaultLogo from "@/assets/branding/logo-default.svg";
import spotifyLogo from "@/assets/branding/logo-spotify.svg";
import yandexLogo from "@/assets/branding/logo-yandex.svg";
import discordLogo from "@/assets/branding/logo-discord.svg";
import telegramLogo from "@/assets/branding/logo-telegram.svg";
import auroraLogo from "@/assets/branding/logo-aurora.svg";
import sunsetLogo from "@/assets/branding/logo-sunset.svg";
import oceanLogo from "@/assets/branding/logo-ocean.svg";
import forestLogo from "@/assets/branding/logo-forest.svg";
import berryLogo from "@/assets/branding/logo-berry.svg";
import carbonLogo from "@/assets/branding/logo-carbon.svg";
import pixelLogo from "@/assets/branding/logo-pixel.svg";
import scanlinesLogo from "@/assets/branding/logo-scanlines.svg";
import vhsLogo from "@/assets/branding/logo-vhs.svg";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

const logos: Record<AccentVariant, string> = {
  default: defaultLogo,
  spotify: spotifyLogo,
  yandex: yandexLogo,
  discord: discordLogo,
  telegram: telegramLogo,
  aurora: auroraLogo,
  sunset: sunsetLogo,
  ocean: oceanLogo,
  forest: forestLogo,
  berry: berryLogo,
  carbon: carbonLogo,
  pixel: pixelLogo,
  scanlines: scanlinesLogo,
  vhs: vhsLogo,
};

const brandingVariants: readonly AccentVariant[] = [
  "default",
  "spotify",
  "yandex",
  "discord",
  "telegram",
  "aurora",
  "sunset",
  "ocean",
  "forest",
  "berry",
  "carbon",
  "pixel",
  "scanlines",
  "vhs",
];

// tiny dashboard mock so theme choice reads visually instead of as text
function ThemeMock({ mode }: { mode: "light" | "dark" }) {
  const dark = mode === "dark";
  return (
    <div className={`flex h-full w-full ${dark ? "bg-[#101012]" : "bg-[#ececee]"}`}>
      <div className={`flex w-[36%] flex-col gap-[4px] p-[8px] ${dark ? "bg-[#1c1c1e]" : "bg-white"}`}>
        <div className="flex gap-[3px] px-[1px] pb-[3px]">
          <span className="h-[4px] w-[4px] rounded-full bg-[#ff5f57]" />
          <span className="h-[4px] w-[4px] rounded-full bg-[#febc2e]" />
          <span className="h-[4px] w-[4px] rounded-full bg-[#28c840]" />
        </div>
        {[22, 16, 20].map((w, i) => (
          <span
            key={i}
            className={`h-[5px] rounded-full ${dark ? "bg-white/15" : "bg-black/10"}`}
            style={{ width: w }}
          />
        ))}
        <span className={`mt-auto h-[12px] rounded-[3px] ${dark ? "bg-white/20" : "bg-black/15"}`} />
      </div>
      <div className="flex flex-1 flex-col gap-[4px] p-[8px]">
        <span className={`h-[6px] w-[46px] rounded-full ${dark ? "bg-white/25" : "bg-black/20"}`} />
        <div className="grid grid-cols-2 gap-[4px]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-[14px] rounded-[3px] ${dark ? "bg-white/10" : "bg-black/[0.07]"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  mode,
  label,
  active,
  onSelect,
}: {
  mode: "light" | "dark" | "system";
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="group flex cursor-pointer flex-col gap-[6px] border-0 bg-transparent p-0 text-left"
    >
      <span
        className={`relative block h-[76px] w-full overflow-hidden rounded-lg border transition-colors ${
          active
            ? "border-text-primary ring-1 ring-text-primary"
            : "border-border-primary group-hover:border-text-tertiary"
        }`}
      >
        {mode === "system" ? (
          <span className="flex h-full w-full">
            <span className="h-full w-1/2 overflow-hidden">
              <ThemeMock mode="light" />
            </span>
            <span className="h-full w-1/2 overflow-hidden">
              <ThemeMock mode="dark" />
            </span>
          </span>
        ) : (
          <ThemeMock mode={mode} />
        )}
        {active ? (
          <span className="absolute right-[6px] top-[6px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-text-primary">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2 6.5L4.5 9L10 3"
                stroke="var(--color-bg-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
      </span>
      <span
        className={`text-[12.5px] leading-none ${active ? "text-text-primary" : "text-text-secondary"}`}
        style={{ ...font, fontWeight: active ? 500 : 400 }}
      >
        {label}
      </span>
    </button>
  );
}

export function AppearanceTab() {
  const { t, locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const accentVariant = usePlayerStore((state) => state.accentVariant);
  const setAccentVariant = usePlayerStore((state) => state.setAccentVariant);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.language.label")}
        description={t("settings.language.description")}
        control={
          mounted ? (
            <Select
              options={LOCALE_OPTIONS}
              value={locale}
              onChange={setLocale}
              align="bottom-right"
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
      >
        {mounted ? (
          <div className="grid grid-cols-3 gap-[10px]">
            {(
              [
                { value: "system", label: t("settings.theme.system") },
                { value: "light", label: t("settings.theme.light") },
                { value: "dark", label: t("settings.theme.dark") },
              ] as const
            ).map((item) => (
              <ThemeCard
                key={item.value}
                mode={item.value}
                label={item.label}
                active={theme === item.value}
                onSelect={() => setTheme(item.value)}
              />
            ))}
          </div>
        ) : null}
      </SettingBlock>

      <SettingBlock
        title={t("settings.branding.title")}
        description={t("settings.branding.description")}
      >
        {mounted ? (
          <div className="flex flex-wrap gap-[2px]">
            {brandingVariants.map((variantId) => {
              const isActive = accentVariant === variantId;
              const label = t(`settings.branding.${variantId}`);
              return (
                <button
                  key={variantId}
                  type="button"
                  onClick={() => setAccentVariant(variantId)}
                  title={label}
                  aria-label={label}
                  aria-pressed={isActive}
                  className={`flex items-center gap-[8px] pl-[8px] pr-[12px] py-[6px] rounded-md border-none transition-colors cursor-pointer ${
                    isActive
                      ? "bg-bg-elevated text-text-primary font-[500]"
                      : "bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                  }`}
                >
                  <div className="w-[22px] h-[22px] flex items-center justify-center shrink-0">
                    <img
                      src={logos[variantId]}
                      alt=""
                      width={20}
                      height={20}
                      className={
                        variantId === "default" ||
                        variantId === "carbon" ||
                        variantId === "pixel" ||
                        variantId === "scanlines"
                          ? "theme-logo invert dark:invert-0"
                          : ""
                      }
                      draggable={false}
                    />
                  </div>
                  <span
                    className="text-[12px] leading-none whitespace-nowrap"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </SettingBlock>
    </SettingSection>
  );
}
