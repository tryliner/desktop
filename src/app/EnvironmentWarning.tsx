import { useState } from "react";
import { WarningFill } from "@mingcute/react";
import { useTranslation } from "@/languages";

const SKIP_KEY = "liner:env-warning-skipped";

// dev-friendly heads-up when the frontend runs in a plain browser instead of
// electron: deeplinks, offline diagnostics and signing need the desktop bridge.
export default function EnvironmentWarning() {
  const { t } = useTranslation();
  const [skipped, setSkipped] = useState(() => {
    try {
      return sessionStorage.getItem(SKIP_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (typeof window !== "undefined" && window.linerElectron) return null;
  if (skipped) return null;

  const skip = () => {
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      // private mode, dismissal just lasts until reload
    }
    setSkipped(true);
  };

  return (
    <div className="fixed left-1/2 top-[12px] z-[150] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-lg bg-[#221d0e] px-[14px] py-[10px]">
      <div className="flex items-center gap-[10px]">
        <WarningFill size={16} className="shrink-0 text-amber-200/90" />
        <p
          className="m-0 min-w-0 flex-1 text-[12.5px] leading-[1.45] font-[500] text-[#f0e6c8]"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {t("common.env_warning")}
        </p>
        <button
          type="button"
          onClick={skip}
          className="shrink-0 rounded-md bg-transparent border border-[#f0e6c8]/25 px-[10px] py-[4px] text-[12px] font-[600] text-[#f0e6c8] hover:bg-white/10 cursor-pointer transition-colors"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {t("common.env_skip")}
        </button>
      </div>
    </div>
  );
}
