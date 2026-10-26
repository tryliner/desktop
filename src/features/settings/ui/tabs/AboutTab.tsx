import { useMemo } from "react";
import { Refresh1Line } from "@mingcute/react";
import { useTranslation, getTranslationsForAllLocales } from "@/languages";
import logo from "@/assets/logo.svg";
import { AboutTabLinks } from "./AboutTabLinks";
import { AboutBackdrop } from "./AboutBackdrop";
import { useAboutAppVersion } from "./useAboutAppVersion";

const font = { fontFamily: "var(--font-inter), sans-serif" } as const;

export function AboutTab({ searchQuery }: { searchQuery?: string }) {
  const { t } = useTranslation();
  const {
    appVersion,
    bundleInfo,
    checkingUpdate,
    lastCheckedTime,
    handleCheckUpdates,
  } = useAboutAppVersion();

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
      getTranslationsForAllLocales(k).some((txt) =>
        txt.toLowerCase().includes(q),
      ),
    );
  }, [searchQuery]);

  if (!isMatch) return null;

  return (
    <div className="relative flex min-h-[340px] w-full flex-col overflow-hidden rounded-[20px] bg-black/[0.04] p-[28px] dark:bg-white/[0.06]">
      <AboutBackdrop />
      <div className="relative flex items-start justify-between">
        <div className="flex flex-col items-start gap-[8px]">
          <img
            src={logo}
            alt=""
            width={45}
            height={35}
            className="theme-logo h-[34px] w-auto"
            draggable={false}
          />
          <span className="font-montserrat text-[22px] font-[700] leading-none text-text-primary">
            {t("settings.about.liner")}
          </span>
        </div>
        <span className="inline-flex h-[34px] items-center gap-[8px] rounded-full bg-black/[0.06] px-[14px] text-[14px] font-[600] text-text-primary select-none dark:bg-white/[0.1]">
          <span className="size-[8px] rounded-full bg-emerald-400" />v
          {bundleInfo?.bundleVersion || appVersion}
        </span>
      </div>

      <div className="relative mt-auto flex flex-col items-start gap-[10px] pt-[40px]">
        <span
          className="text-[13px] text-text-secondary select-none"
          style={font}
        >
          {bundleInfo?.isOta
            ? `Client ${bundleInfo.bundleVersion}${bundleInfo.sha256 ? ` (${bundleInfo.sha256.slice(0, 7)})` : ""} · Core ${appVersion}`
            : `Client ${appVersion} (native)`}
          {lastCheckedTime ? ` · ${lastCheckedTime}` : ""}
        </span>
        <button
          type="button"
          onClick={handleCheckUpdates}
          disabled={checkingUpdate}
          className="flex h-[42px] items-center gap-[10px] rounded-[12px] border-0 bg-text-primary/85 px-[18px] text-[15px] font-[500] text-bg-primary transition-colors hover:bg-text-primary disabled:cursor-default disabled:opacity-70"
        >
          <Refresh1Line
            size={18}
            className={checkingUpdate ? "animate-spin" : undefined}
          />
          {checkingUpdate
            ? t("settings.about.checking_updates")
            : t("settings.about.check_updates")}
        </button>
        <div className="mt-[18px]">
          <AboutTabLinks />
        </div>
      </div>
    </div>
  );
}
