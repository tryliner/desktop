import { Download2Line, CheckLine, CloseLine, Refresh1Line } from "@mingcute/react";
import { useDownloadTrack } from "../hooks/useDownloadTrack";

export interface DownloadButtonProps {
  trackId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function DownloadButton({ trackId, className = "", size = "md" }: DownloadButtonProps) {
  const { download, status, progress, isCached } = useDownloadTrack(trackId);

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  };

  const buttonSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const iconSize = iconSizes[size];

  if (isCached || status === "complete") {
    return (
      <button
        type="button"
        title="Saved offline"
        aria-label="Saved offline"
        disabled
        className={`inline-flex items-center justify-center rounded-full text-emerald-500 bg-emerald-500/10 ${buttonSizes[size]} ${className}`}
      >
        <CheckLine size={iconSize} />
      </button>
    );
  }

  if (status === "downloading" || status === "queued") {
    return (
      <button
        type="button"
        title={status === "downloading" ? `Downloading (${progress}%)` : "Queued"}
        aria-label={status === "downloading" ? `Downloading (${progress}%)` : "Queued"}
        disabled
        className={`inline-flex items-center justify-center rounded-full text-text-primary bg-white/10 relative ${buttonSizes[size]} ${className}`}
      >
        <Refresh1Line size={iconSize} className="animate-spin text-text-secondary" />
        {status === "downloading" && progress > 0 && (
          <span className="sr-only">{progress}%</span>
        )}
      </button>
    );
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={download}
        title="Download failed, click to retry"
        aria-label="Download failed, click to retry"
        className={`inline-flex items-center justify-center rounded-full text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors ${buttonSizes[size]} ${className}`}
      >
        <CloseLine size={iconSize} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      title="Download for offline playback"
      aria-label="Download for offline playback"
      className={`inline-flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors ${buttonSizes[size]} ${className}`}
    >
      <Download2Line size={iconSize} />
    </button>
  );
}

export default DownloadButton;
