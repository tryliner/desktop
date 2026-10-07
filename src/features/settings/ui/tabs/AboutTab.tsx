import { useState, useEffect, useMemo } from "react";
import { FaTelegramPlane, FaGithub, FaGlobe } from "react-icons/fa";
import { Refresh1Line, CheckLine, ExternalLinkLine } from "@mingcute/react";
import { QuestionCircle, CodeSquare, Keyboard, ShieldCheck } from "@solar-icons/react";
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
import { SettingSection } from "../controls";

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

  const isMatch = useMemo(() => {
    if (!searchQuery?.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const searchableKeys = [
      "settings.about.liner",
      "settings.about.tagline",
      "settings.about.updates_title",
      "settings.about.tech_stack_title",
      "settings.about.shortcuts_title",
      "settings.about.community_title",
    ];
    return searchableKeys.some((k) =>
      getTranslationsForAllLocales(k).some((txt) => txt.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  if (!isMatch) return null;

  return (
    <div className="flex w-full flex-col gap-[20px] py-[4px]">
      {/* ── 1. Top Hero Card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-border-alpha-10 p-[18px] flex items-center gap-[18px] border border-border-primary/50">
        <div className="bg-bg-elevated flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl border border-border-primary/60 shadow-sm">
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

        <div className="flex flex-1 flex-col min-w-0 justify-center">
          <div className="flex items-center gap-[8px]">
            <h2
              className="text-text-primary text-[19px] font-[650] tracking-[-0.015em] leading-none m-0"
              style={font}
            >
              {t("settings.about.liner")}
            </h2>
            <div
              className="inline-flex items-center gap-[5px] h-[21px] rounded-full bg-border-alpha-14 px-[8px] border border-border-primary/50 text-[11px] font-[500] text-text-secondary select-none"
              style={font}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-emerald-400" />
              <span>v{bundleInfo?.bundleVersion || appVersion}</span>
            </div>
          </div>

          <p
            className="text-text-tertiary text-[12.5px] leading-snug mt-[6px] mb-0 max-w-[480px]"
            style={font}
          >
            {t("settings.about.tagline")}
          </p>
        </div>
      </div>

      {/* ── 2. Updates & Installation Status ── */}
      <SettingSection label={t("settings.about.updates_title")}>
        <div className="rounded-xl border border-border-primary/50 bg-border-alpha-10 p-[14px] flex items-center justify-between gap-[16px] my-[6px]">
          <div className="flex flex-col gap-[3px] min-w-0">
            <div className="flex items-center gap-[7px]">
              <span
                className="text-text-primary text-[13px] font-[500]"
                style={font}
              >
                {t("settings.about.up_to_date")}
              </span>
              <span className="inline-flex items-center gap-[4px] rounded-full bg-emerald-500/10 text-emerald-400 px-[6px] py-[1px] text-[10.5px] font-[500]">
                <CheckLine size={11} />
                <span>Active</span>
              </span>
            </div>
            <span
              className="text-text-tertiary text-[12px] truncate"
              style={font}
            >
              {bundleInfo?.isOta
                ? `OTA Web Bundle v${bundleInfo.bundleVersion}${bundleInfo.sha256 ? ` (${bundleInfo.sha256.slice(0, 7)})` : ""} · Host v${appVersion}`
                : `Native Production Build · Host v${appVersion}`}
              {lastCheckedTime ? ` · Last checked ${lastCheckedTime}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-[6px] shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCheckUpdates}
              disabled={checkingUpdate}
              className="!h-[30px] !px-[12px] !text-[12px] !gap-[6px]"
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
      </SettingSection>

      {/* ── 3. Technology & Engine Grid ── */}
      <SettingSection label={t("settings.about.tech_stack_title")}>
        <div className="grid grid-cols-2 gap-[10px] my-[6px]">
          <div className="flex flex-col gap-[4px] rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px]">
            <div className="flex items-center gap-[7px]">
              <CodeSquare size={16} className="text-text-secondary" />
              <span className="text-text-primary text-[13px] font-[500]" style={font}>
                {t("settings.about.tech_electron")}
              </span>
            </div>
            <span className="text-text-tertiary text-[12px] leading-relaxed" style={font}>
              {t("settings.about.tech_electron_desc")}
            </span>
          </div>

          <div className="flex flex-col gap-[4px] rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px]">
            <div className="flex items-center gap-[7px]">
              <ShieldCheck size={16} className="text-text-secondary" />
              <span className="text-text-primary text-[13px] font-[500]" style={font}>
                {t("settings.about.tech_wasm")}
              </span>
            </div>
            <span className="text-text-tertiary text-[12px] leading-relaxed" style={font}>
              {t("settings.about.tech_wasm_desc")}
            </span>
          </div>

          <div className="flex flex-col gap-[4px] rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px]">
            <div className="flex items-center gap-[7px]">
              <span className="h-[8px] w-[8px] rounded-full bg-cyan-400" />
              <span className="text-text-primary text-[13px] font-[500]" style={font}>
                {t("settings.about.tech_react")}
              </span>
            </div>
            <span className="text-text-tertiary text-[12px] leading-relaxed" style={font}>
              {t("settings.about.tech_react_desc")}
            </span>
          </div>

          <div className="flex flex-col gap-[4px] rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px]">
            <div className="flex items-center gap-[7px]">
              <span className="h-[8px] w-[8px] rounded-full bg-indigo-400" />
              <span className="text-text-primary text-[13px] font-[500]" style={font}>
                {t("settings.about.tech_lyrics")}
              </span>
            </div>
            <span className="text-text-tertiary text-[12px] leading-relaxed" style={font}>
              {t("settings.about.tech_lyrics_desc")}
            </span>
          </div>
        </div>
      </SettingSection>

      {/* ── 4. Quick Shortcuts ── */}
      <SettingSection label={t("settings.about.shortcuts_title")}>
        <div className="grid grid-cols-2 gap-[8px] my-[6px]">
          <div className="flex items-center justify-between rounded-lg border border-border-primary/30 bg-border-alpha-10 px-[12px] py-[8px]">
            <span className="text-text-secondary text-[12.5px]" style={font}>
              {t("settings.about.shortcut_play")}
            </span>
            <kbd className="rounded border border-border-primary/60 bg-bg-elevated px-[6px] py-[1.5px] text-[11px] font-[500] text-text-primary shadow-xs">
              Space
            </kbd>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-primary/30 bg-border-alpha-10 px-[12px] py-[8px]">
            <span className="text-text-secondary text-[12.5px]" style={font}>
              {t("settings.about.shortcut_search")}
            </span>
            <kbd className="rounded border border-border-primary/60 bg-bg-elevated px-[6px] py-[1.5px] text-[11px] font-[500] text-text-primary shadow-xs">
              Ctrl + K
            </kbd>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-primary/30 bg-border-alpha-10 px-[12px] py-[8px]">
            <span className="text-text-secondary text-[12.5px]" style={font}>
              {t("settings.about.shortcut_lyrics")}
            </span>
            <kbd className="rounded border border-border-primary/60 bg-bg-elevated px-[6px] py-[1.5px] text-[11px] font-[500] text-text-primary shadow-xs">
              L
            </kbd>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-primary/30 bg-border-alpha-10 px-[12px] py-[8px]">
            <span className="text-text-secondary text-[12.5px]" style={font}>
              {t("settings.about.shortcut_mini")}
            </span>
            <kbd className="rounded border border-border-primary/60 bg-bg-elevated px-[6px] py-[1.5px] text-[11px] font-[500] text-text-primary shadow-xs">
              Alt + Shift + O
            </kbd>
          </div>
        </div>
      </SettingSection>

      {/* ── 5. Community & Links ── */}
      <SettingSection label={t("settings.about.community_title")}>
        <div className="grid grid-cols-2 gap-[8px] my-[6px]">
          <button
            type="button"
            onClick={() => openUrl("https://t.me/liner_app")}
            className="flex items-center justify-between rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px] text-left hover:border-border-primary hover:bg-border-alpha-14 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-lg bg-[#2AABEE]/15 text-[#2AABEE]">
                <FaTelegramPlane size={15} />
              </div>
              <div className="flex flex-col">
                <span className="text-text-primary text-[13px] font-[500]" style={font}>
                  {t("settings.about.telegram")}
                </span>
                <span className="text-text-tertiary text-[11.5px]" style={font}>
                  @liner_app
                </span>
              </div>
            </div>
            <ExternalLinkLine size={14} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => openUrl("https://t.me/liner_app?direct")}
            className="flex items-center justify-between rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px] text-left hover:border-border-primary hover:bg-border-alpha-14 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-lg bg-border-alpha-14 text-text-secondary">
                <QuestionCircle size={17} weight="Bold" />
              </div>
              <div className="flex flex-col">
                <span className="text-text-primary text-[13px] font-[500]" style={font}>
                  {t("settings.about.support")}
                </span>
                <span className="text-text-tertiary text-[11.5px]" style={font}>
                  Telegram Direct
                </span>
              </div>
            </div>
            <ExternalLinkLine size={14} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => openUrl("https://github.com/tryliner/desktop")}
            className="flex items-center justify-between rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px] text-left hover:border-border-primary hover:bg-border-alpha-14 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-lg bg-border-alpha-14 text-text-primary">
                <FaGithub size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-text-primary text-[13px] font-[500]" style={font}>
                  {t("settings.about.github")}
                </span>
                <span className="text-text-tertiary text-[11.5px]" style={font}>
                  tryliner/desktop
                </span>
              </div>
            </div>
            <ExternalLinkLine size={14} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => openUrl("https://tryliner.fun")}
            className="flex items-center justify-between rounded-xl border border-border-primary/40 bg-border-alpha-10 p-[12px] text-left hover:border-border-primary hover:bg-border-alpha-14 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-lg bg-border-alpha-14 text-text-secondary">
                <FaGlobe size={15} />
              </div>
              <div className="flex flex-col">
                <span className="text-text-primary text-[13px] font-[500]" style={font}>
                  {t("settings.about.website")}
                </span>
                <span className="text-text-tertiary text-[11.5px]" style={font}>
                  tryliner.fun
                </span>
              </div>
            </div>
            <ExternalLinkLine size={14} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
          </button>
        </div>

        <div className="pt-[10px] pb-[6px] text-center">
          <span className="text-text-tertiary text-[11.5px]" style={font}>
            {t("settings.about.license_notice")}
          </span>
        </div>
      </SettingSection>
    </div>
  );
}
