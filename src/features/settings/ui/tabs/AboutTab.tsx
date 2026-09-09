import { FaTelegramPlane } from "react-icons/fa";
import Button from "@/shared/ui/Button";
import { useTranslation } from "@/languages";
import logo from "@/assets/logo.svg";
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
import { usePlayerStore, type AccentVariant } from "@/features/player";

const brandingLogos: Record<Exclude<AccentVariant, "default">, string> = {
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

export function AboutTab() {
  const { t } = useTranslation();
  const accentVariant = usePlayerStore((state) => state.accentVariant);

  const openTelegram = () => {
    window.open("https://t.me/liner_app", "_blank");
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[40vh] gap-[16px]">
      <div className="w-[80px] h-[80px] rounded-2xl bg-bg-elevated border border-border-primary flex items-center justify-center shadow-sm">
        <img
          src={
            accentVariant === "default"
              ? logo
              : brandingLogos[accentVariant]
          }
          alt="Liner Logo"
          width={48}
          height={48}
          className={
            "w-[48px] h-[48px] " +
            (accentVariant === "default" ||
            accentVariant === "carbon" ||
            accentVariant === "pixel" ||
            accentVariant === "scanlines"
              ? "theme-logo invert dark:invert-0"
              : "")
          }
          draggable={false}
        />
      </div>

      <div className="flex flex-col items-center gap-[4px]">
        <h2
          className="text-text-primary text-[24px] font-medium m-0"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {t("settings.about.liner")}
        </h2>
        <p className="text-text-tertiary text-[14px] m-0">
          {t("common.app.version")}
        </p>
      </div>

      <div className="flex gap-[12px] mt-[16px]">
        <Button variant="secondary" onClick={openTelegram}>
          <FaTelegramPlane size={15} className="mt-[1px]" />
          {t("settings.about.telegram")}
        </Button>
      </div>
    </div>
  );
}
