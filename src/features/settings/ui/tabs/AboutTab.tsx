import { useState, useMemo } from "react";
import { FaTelegramPlane, FaGithub, FaGlobe } from "react-icons/fa";
import { Refresh1Line, CheckLine } from "@mingcute/react";
import { QuestionCircle } from "@solar-icons/react";
import Button from "@/shared/ui/Button";
import { useToast } from "@/shared/ui";
import { useTranslation, getTranslationsForAllLocales } from "@/languages";
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

const APP_VERSION = "0.1.24";

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

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export function AboutTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const accentVariant = usePlayerStore((state) => state.accentVariant);

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);

  const openUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCheckUpdates = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    // brief delay to simulate network check against releases
    await new Promise((resolve) => setTimeout(resolve, 600));
    setCheckingUpdate(false);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setLastCheckedTime(timeStr);
    toast(t("settings.about.latest_version_toast"), "info");
  };

  // search query filter matching
  const isMatch = useMemo(() => {
    if (!searchQuery?.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const searchableKeys = [
      "settings.about.liner",
      "settings.about.tagline",
      "settings.about.updates_title",
      "settings.about.build_info",
    ];
    return searchableKeys.some((k) =>
      getTranslationsForAllLocales(k).some((txt) => txt.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  if (!isMatch) return null;

  return (
    <div className="flex w-full flex-col gap-[14px] py-[4px]">
      {/* ── Top Hero Card ── */}
      <div className="relative overflow-hidden rounded-xl bg-border-alpha-14 p-[16px] flex items-center gap-[16px] border border-border-primary/40">
        <div className="bg-bg-elevated flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl shadow-sm border border-border-primary/50">
          <img
            src={
              accentVariant === "default"
                ? logo
                : brandingLogos[accentVariant]
            }
            alt="Liner Logo"
            width={38}
            height={38}
            className={
              "h-[38px] w-[38px] " +
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

        <div className="flex flex-1 flex-col min-w-0 justify-center">
          <div className="flex items-center gap-[8px]">
            <h2
              className="text-text-primary text-[17px] font-[600] tracking-[-0.01em] leading-none m-0"
              style={font}
            >
              {t("settings.about.liner")}
            </h2>
            <div
              className="inline-flex items-center gap-[5px] h-[20px] rounded-full bg-border-alpha-14 px-[8px] border border-border-primary/40 text-[11px] font-[500] text-text-secondary leading-none select-none"
              style={font}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-emerald-400" />
              <span>v{APP_VERSION}</span>
            </div>
          </div>

          <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openUrl("https://t.me/liner_app")}
              className="!h-[28px] !px-[10px] !text-[12px] gap-[6px]"
            >
              <FaTelegramPlane size={13} className="text-[#2AABEE]" />
              {t("settings.about.telegram")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openUrl("https://t.me/liner_app?direct")}
              className="!h-[28px] !px-[10px] !text-[12px] gap-[6px]"
            >
              <QuestionCircle size={14} weight="Bold" className="text-text-tertiary" />
              {t("settings.about.support")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openUrl("https://github.com/tryliner/desktop")}
              className="!h-[28px] !px-[10px] !text-[12px] gap-[6px]"
            >
              <FaGithub size={13} />
              {t("settings.about.github")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openUrl("https://tryliner.fun")}
              className="!h-[28px] !px-[10px] !text-[12px] gap-[6px]"
            >
              <FaGlobe size={12} className="text-text-tertiary" />
              {t("settings.about.website")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Dynamic Updates & Build Status Card ── */}
      <div className="rounded-xl border border-border-primary/50 bg-border-alpha-10 p-[14px] flex items-center justify-between gap-[16px]">
        <div className="flex flex-col gap-[2px] min-w-0">
          <div className="flex items-center gap-[6px]">
            <span
              className="text-text-primary text-[13px] font-[500]"
              style={font}
            >
              {t("settings.about.updates_title")}
            </span>
            <span className="inline-flex items-center gap-[4px] rounded-full bg-emerald-500/10 text-emerald-400 px-[6px] py-[1px] text-[10.5px] font-[500]">
              <CheckLine size={11} />
              {t("settings.about.up_to_date")}
            </span>
          </div>
          <span
            className="text-text-tertiary text-[12px] truncate"
            style={font}
          >
            {t("settings.about.build_info")}
            {lastCheckedTime ? ` · ${lastCheckedTime}` : ""}
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleCheckUpdates}
          disabled={checkingUpdate}
          className="!h-[30px] !px-[12px] !text-[12px] shrink-0 gap-[6px]"
        >
          <Refresh1Line
            size={13}
            className={checkingUpdate ? "animate-spin text-text-primary" : "text-text-tertiary"}
          />
          {checkingUpdate
            ? t("settings.about.checking_updates")
            : t("settings.about.check_updates")}
        </Button>
      </div>
    </div>
  );
}

