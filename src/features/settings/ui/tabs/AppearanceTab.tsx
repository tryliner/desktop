import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { usePlayerStore, type AccentVariant } from "@/features/player";
import { useTranslation } from "@/languages";
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

export function AppearanceTab() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const miniPlayerStyle = usePlayerStore((state) => state.miniPlayerStyle);
  const setMiniPlayerStyle = usePlayerStore(
    (state) => state.setMiniPlayerStyle,
  );
  const accentVariant = usePlayerStore((state) => state.accentVariant);
  const setAccentVariant = usePlayerStore((state) => state.setAccentVariant);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.theme.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.theme.description")}
          </p>
        </div>

        {mounted && (
          <div className="inline-flex items-center gap-[6px] rounded-xl bg-bg-elevated border border-border-primary p-[5px]">
            {(["light", "dark", "system"] as const).map((tVal) => {
              const isActive = theme === tVal;
              const label =
                tVal === "light"
                  ? t("settings.theme.light")
                  : tVal === "dark"
                    ? t("settings.theme.dark")
                    : t("settings.theme.system");
              return (
                <button
                  key={tVal}
                  type="button"
                  onClick={() => setTheme(tVal)}
                  className={`inline-flex items-center gap-[5px] rounded-md px-[18px] py-[8px] text-[14px] leading-none capitalize border-0 cursor-pointer ${
                    isActive
                      ? "bg-border-alpha-14 text-text-primary shadow-sm"
                      : "bg-transparent text-text-secondary hover:text-text-primary"
                  }`}
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.customization.mini_player_style.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.customization.mini_player_style.description")}
          </p>
        </div>

        {mounted && (
          <div className="inline-flex items-center gap-[6px] rounded-xl bg-bg-elevated border border-border-primary p-[5px]">
            {(
              [
                {
                  value: "default",
                  label: t("settings.customization.mini_player_style.default"),
                },
                {
                  value: "rounded",
                  label: t("settings.customization.mini_player_style.rounded"),
                },
              ] as const
            ).map((item) => {
              const isActive = miniPlayerStyle === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMiniPlayerStyle(item.value)}
                  className={`inline-flex items-center gap-[5px] rounded-md px-[18px] py-[8px] text-[14px] leading-none border-0 cursor-pointer ${
                    isActive
                      ? "bg-border-alpha-14 text-text-primary shadow-sm"
                      : "bg-transparent text-text-secondary hover:text-text-primary"
                  }`}
                  style={{
                    fontFamily: "var(--font-inter), sans-serif",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[12px] pt-[8px]">
        <div className="flex flex-col gap-[4px]">
          <h3 className="text-text-primary text-[15px] font-medium m-0">
            {t("settings.branding.title")}
          </h3>
          <p className="text-text-tertiary text-[13px] m-0">
            {t("settings.branding.description")}
          </p>
        </div>

        {mounted && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-[10px] mt-[4px]">
            {brandingVariants.map((variantId) => {
              const isActive = accentVariant === variantId;
              const label = t(`settings.branding.${variantId}`);
              return (
                <button
                  key={variantId}
                  type="button"
                  onClick={() => setAccentVariant(variantId)}
                  className={`flex flex-col items-center gap-[8px] p-[12px] rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? "bg-bg-elevated border-text-primary/40 shadow-sm"
                      : "bg-transparent border-border-primary hover:border-border-primary/80 hover:bg-bg-elevated/50"
                  }`}
                >
                  <div className="w-[32px] h-[32px] flex items-center justify-center">
                    <img
                      src={logos[variantId]}
                      alt={label}
                      width={28}
                      height={28}
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
                    className={`text-[12px] leading-none ${
                      isActive ? "text-text-primary font-medium" : "text-text-secondary"
                    }`}
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
