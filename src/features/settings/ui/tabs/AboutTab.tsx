import { useState, useEffect, useMemo } from "react";
import { FaTelegramPlane, FaGithub, FaGlobe } from "react-icons/fa";
import { Refresh1Line, CheckLine } from "@mingcute/react";
import { QuestionCircle } from "@solar-icons/react";
import Button from "@/shared/ui/Button";
import { useToast } from "@/shared/ui";
import { useTranslation, getTranslationsForAllLocales } from "@/languages";
import { APP_VERSION } from "@/shared/config/version";
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
import { useUpdaterStore } from "@/features/updater";

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

  const [appVersion, setAppVersion] = useState(APP_VERSION);
  const [bundleInfo, setBundleInfo] = useState<{
    bundleVersion: string;
    isOta: boolean;
    sha256: string | null;
  } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);

  useEffect(() => {
    // dynamically query electron runtime version & bundle status
    if (window.linerElectron) {
      window.linerElectron
        .getAppVersion?.()
        .then((ver) => {
          if (ver) setAppVersion(ver);
        })
        .catch(() => {});

      window.linerElectron
        .bundleGetStatus?.()
        .then((status) => {
          if (status) {
            setBundleInfo({
              bundleVersion: status.bundleVersion,
              isOta: status.isOta,
              sha256: status.sha256,
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const openUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCheckUpdates = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      await useUpdaterStore.getState().checkForUpdates();
      const status = useUpdaterStore.getState().status;
      const updateInfo = useUpdaterStore.getState().updateInfo;
      if (status === "available" && updateInfo) {
        useUpdaterStore.getState().openDialog();
      } else {
        toast(t("settings.about.latest_version_toast", { version: appVersion }), "info");
      }
    } catch {
      toast(t("settings.about.latest_version_toast", { version: appVersion }), "info");
    } finally {
      setCheckingUpdate(false);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastCheckedTime(timeStr);
    }
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
    <div className="flex w-full flex-col items-center justify-center py-[24px]">
      {/* ── Unified Centered About Card ── */}
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-2xl bg-border-alpha-14 p-[24px] flex flex-col items-center text-center border border-border-primary/40 shadow-sm">
        {/* Logo */}
        <div className="bg-bg-elevated flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl border border-border-primary/50 shadow-inner mb-[14px]">
          <img
            src={
              accentVariant === "default"
                ? logo
                : brandingLogos[accentVariant]
            }
            alt="Liner Logo"
            width={44}
            height={44}
            className={
              "h-[44px] w-[44px] " +
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

        {/* Title & Version badge */}
        <div className="flex items-center gap-[8px] mb-[6px]">
          <h2
            className="text-text-primary text-[20px] font-[600] tracking-[-0.01em] leading-none m-0"
            style={font}
          >
            {t("settings.about.liner")}
          </h2>
          <div
            className="inline-flex items-center gap-[5px] h-[22px] rounded-full bg-border-alpha-14 px-[9px] border border-border-primary/40 text-[11.5px] font-[500] text-text-secondary leading-none select-none"
            style={font}
          >
            <span className="h-[5.5px] w-[5.5px] rounded-full bg-emerald-400" />
            <span>v{bundleInfo?.bundleVersion || appVersion}</span>
          </div>
        </div>

        {/* Core & bundle info subtitle */}
        <span
          className="text-text-tertiary text-[12px] mb-[18px] select-none"
          style={font}
        >
          {bundleInfo?.isOta
            ? `Client ${bundleInfo.bundleVersion}${bundleInfo.sha256 ? ` (${bundleInfo.sha256.slice(0, 7)})` : ""} · Core ${appVersion}`
            : `Client ${appVersion} (native)`}
          {lastCheckedTime ? ` · ${lastCheckedTime}` : ""}
        </span>

        {/* Update Checker Button */}
        <div className="w-full flex items-center justify-center mb-[20px]">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCheckUpdates}
            disabled={checkingUpdate}
            className="!h-[32px] !px-[16px] !text-[12.5px] !gap-[7px] !rounded-lg"
          >
            <Refresh1Line
              size={14}
              className={checkingUpdate ? "animate-spin text-text-primary" : "text-text-tertiary"}
            />
            {checkingUpdate
              ? t("settings.about.checking_updates")
              : t("settings.about.check_updates")}
          </Button>
        </div>

        {/* Social & Support Links */}
        <div className="flex flex-wrap items-center justify-center gap-[6px] w-full pt-[16px] border-t border-border-primary/30">
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
  );
}

