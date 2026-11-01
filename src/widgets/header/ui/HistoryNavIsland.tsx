import { LeftLine, RightLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { useHistoryNavigation } from "../lib/useHistoryNavigation";

const NAV_BUTTON_CLASS =
  "flex w-[26px] h-[26px] items-center justify-center rounded-md border-0 bg-transparent p-0 cursor-pointer select-none text-text-primary opacity-55 transition-[background-color,color,opacity] duration-150 hover:opacity-100 hover:bg-border-alpha-14 active:scale-95 disabled:!opacity-25 disabled:cursor-default disabled:pointer-events-none";

export interface HistoryNavIslandProps {
  className?: string;
}

export function HistoryNavIsland({ className }: HistoryNavIslandProps) {
  const { t } = useTranslation();
  const { canGoBack, canGoForward, goBack, goForward } = useHistoryNavigation();

  return (
    <div
      data-no-window-drag
      data-no-tooltip="true"
      className={cn(
        "h-[38px] flex items-center gap-[2px] px-[4px] rounded-[10px] shrink-0 bg-bg-glass backdrop-blur-[20px]",
        className,
      )}
    >
      <button
        type="button"
        onClick={goBack}
        disabled={!canGoBack}
        aria-label={t("common.back")}
        className={NAV_BUTTON_CLASS}
      >
        <LeftLine size={18} />
      </button>
      <button
        type="button"
        onClick={goForward}
        disabled={!canGoForward}
        aria-label={t("common.forward")}
        className={NAV_BUTTON_CLASS}
      >
        <RightLine size={18} />
      </button>
    </div>
  );
}
