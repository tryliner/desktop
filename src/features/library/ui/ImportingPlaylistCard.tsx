import { useTranslation } from "@/languages";
import { PlaylistFill } from "@mingcute/react";
import type { ImportJob } from "@/shared/contracts/imports";
import type { LibraryViewMode } from "../types";
import { useModalStore } from "../store/modalStore";

interface ImportingPlaylistCardProps {
  job: ImportJob;
  viewMode?: LibraryViewMode;
}

export default function ImportingPlaylistCard({
  job,
  viewMode = "grid",
}: ImportingPlaylistCardProps) {
  const { t } = useTranslation();
  const isAwaiting = job.status === "awaiting_decision";
  const isRunning = job.status === "running";
  const isQueued = job.status === "queued";
  const isFinalizing = job.status === "finalizing";

  const displayTitle = job.title || t("import.active_import");

  const getSubtitle = () => {
    if (isQueued) {
      if (job.queuePosition && job.queuePosition > 0) {
        return t("import.status_queued_position", { position: job.queuePosition });
      }
      return t("import.status_queued");
    }
    if (isRunning) {
      if (job.result?.total) {
        const processed = (job.result.imported ?? 0) + (job.result.skipped ?? 0);
        return t("import.status_running_progress", {
          count: processed,
          total: job.result.total,
        });
      }
      return t("import.status_searching_sub");
    }
    if (isAwaiting) return t("import.status_awaiting_decision");
    if (isFinalizing) return t("import.status_finalizing_sub");
    return t("import.status_searching");
  };

  const displaySubtitle = getSubtitle();

  const handleClick = () => {
    if (isAwaiting) {
      useModalStore.getState().openImportReview(job.id);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={handleClick}
        className={`w-full flex items-center justify-between rounded-md p-[8px] select-none transition-all duration-150 ${
          isAwaiting
            ? "cursor-pointer hover:bg-border-alpha-14 opacity-90"
            : "cursor-default opacity-70"
        }`}
      >
        <div className="flex items-center gap-[16px] min-w-0 flex-1">
          <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-md bg-bg-panel border border-border-primary/40 flex items-center justify-center">
            {isAwaiting ? (
              <PlaylistFill size={22} className="text-text-tertiary/60" />
            ) : (
              <div className="h-[20px] w-[20px] animate-spin rounded-full border-[2px] border-text-tertiary/20 border-t-text-primary" />
            )}
          </div>

          <div className="min-w-0 flex flex-col gap-[2px] flex-1">
            <h3
              className="m-0 max-w-[min(52vw,560px)] overflow-hidden text-ellipsis whitespace-nowrap text-[16px] leading-[1.2] text-text-primary"
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                fontWeight: 400,
              }}
            >
              {displayTitle}
            </h3>
            <p
              className="m-0 flex min-w-0 items-center gap-[6px] text-[14px] leading-[1.2] overflow-hidden text-text-secondary"
              style={{
                fontFamily: "var(--font-inter), sans-serif",
                fontWeight: 350,
              }}
            >
              <span
                className={`inline-block h-[6px] w-[6px] rounded-full bg-text-primary shrink-0 ${
                  isAwaiting ? "" : "animate-pulse"
                }`}
              />
              <span className="truncate">{displaySubtitle}</span>
            </p>
          </div>
        </div>

        {isAwaiting && (
          <span className="shrink-0 text-[11px] px-[8px] py-[3px] rounded-[3px] bg-white/10 text-text-primary font-medium">
            {t("import.review_action")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`group flex flex-col gap-[8px] select-none transition-all ${
        isAwaiting
          ? "cursor-pointer opacity-90 hover:opacity-100"
          : "cursor-default opacity-70"
      }`}
      draggable={false}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md flex flex-col items-center justify-center bg-bg-panel border border-border-primary/40">
        {isAwaiting ? (
          <PlaylistFill size={44} className="text-text-tertiary/50" />
        ) : (
          <div className="h-[28px] w-[28px] animate-spin rounded-full border-[2px] border-text-tertiary/20 border-t-text-primary" />
        )}

        {isRunning && job.result?.total ? (
          <div className="absolute bottom-[8px] left-[8px] right-[8px]">
            <div className="h-[3px] w-full rounded-full bg-border-alpha-14 overflow-hidden">
              <div
                className="h-full bg-text-primary transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (((job.result.imported ?? 0) + (job.result.skipped ?? 0)) /
                        job.result.total) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {isAwaiting && (
          <span className="absolute top-[8px] right-[8px] text-[10px] px-[6px] py-[2px] rounded-[3px] bg-white/10 text-text-primary font-medium">
            {t("import.status_awaiting_decision")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-[4px] min-w-0">
        <span className="truncate text-[14px] font-[500] text-text-primary">
          {displayTitle}
        </span>
        <span className="truncate text-[13px] text-text-tertiary flex items-center gap-[5px]">
          <span
            className={`inline-block h-[6px] w-[6px] rounded-full bg-text-primary shrink-0 ${
              isAwaiting ? "" : "animate-pulse"
            }`}
          />
          <span className="truncate">{displaySubtitle}</span>
        </span>
      </div>
    </div>
  );
}
