import { CheckCircleFill, TimeLine, WarningLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import { useTrackDownloadState } from "../hooks/useDownloads";
import { retryDownload } from "../store/savedTracksStore";

/**
 * Tiny status next to a song's duration: downloaded, filling up, waiting
 * in line, or failed (click to retry). Renders nothing for other songs.
 */
export function TrackDownloadBadge({ trackId }: { trackId?: string }) {
  const { t } = useTranslation();
  const { state, progress } = useTrackDownloadState(trackId);
  if (!state) return null;

  if (state === "downloaded") {
    return (
      <span
        title={t("downloads.downloaded_badge")}
        aria-label={t("downloads.downloaded_badge")}
        className="flex shrink-0 items-center text-emerald-400"
      >
        <CheckCircleFill size={15} />
      </span>
    );
  }
  if (state === "downloading") {
    const radius = 6;
    const circumference = 2 * Math.PI * radius;
    return (
      <span
        title={t("downloads.now")}
        aria-label={t("downloads.now")}
        className="flex shrink-0 items-center text-text-secondary"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          className={progress === null ? "animate-spin" : undefined}
        >
          <circle
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2"
          />
          <circle
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - (progress ?? 0.25))}
            transform="rotate(-90 8 8)"
          />
        </svg>
      </span>
    );
  }
  if (state === "queued") {
    return (
      <span
        title={t("downloads.queued_badge")}
        aria-label={t("downloads.queued_badge")}
        className="flex shrink-0 items-center text-text-tertiary"
      >
        <TimeLine size={15} />
      </span>
    );
  }
  return (
    <button
      type="button"
      title={t("downloads.failed_badge")}
      aria-label={t("downloads.failed_badge")}
      onClick={(e) => {
        e.stopPropagation();
        if (trackId) retryDownload(trackId);
      }}
      className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-0 text-amber-400 hover:text-amber-300"
    >
      <WarningLine size={15} />
    </button>
  );
}
