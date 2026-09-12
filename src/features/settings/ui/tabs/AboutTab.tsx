import { FaTelegramPlane } from "react-icons/fa";
import Button from "@/shared/ui/Button";
import { useTranslation } from "@/languages";
import logo from "@/assets/logo.svg";
import spotifyLogo from "@/assets/branding/logo-spotify.svg";
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

export function AboutTab({ searchQuery: _searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const accentVariant = usePlayerStore((state) => state.accentVariant);

  const openTelegram = () => {
    window.open("https://t.me/liner_app", "_blank");
  };


  // centers about content in the middle of the settings tab
  return (
    <div className="flex-1 flex w-full flex-col items-center justify-center gap-[12px] py-[32px]">
      <div className="bg-bg-elevated flex h-[60px] w-[60px] items-center justify-center rounded-2xl">
        <img
          src={
            accentVariant === "default"
              ? logo
              : brandingLogos[accentVariant]
          }
          alt="Liner Logo"
          width={40}
          height={40}
          className={
            "h-[40px] w-[40px] " +
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

      <div className="flex flex-col items-center gap-[2px]">
        <h2
          className="text-text-primary text-[17px] font-[600] tracking-[-0.01em] m-0"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {t("settings.about.liner")}
        </h2>
        <p
          className="text-text-tertiary text-[12.5px] m-0"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {t("common.app.version")}
        </p>
      </div>

      <div className="mt-[8px] flex gap-[8px]">
        <Button variant="secondary" size="sm" onClick={openTelegram}>
          <FaTelegramPlane size={14} className="mt-[1px]" />
          {t("settings.about.telegram")}
        </Button>
      </div>
    </div>
  );
}
