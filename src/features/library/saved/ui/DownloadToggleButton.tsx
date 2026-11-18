import { useEffect, useRef, useState } from "react";
import { CheckCircleFill, DownloadLine } from "@mingcute/react";
import Button from "@/shared/ui/Button";
import { HERO_BUTTON_CLASS, HERO_GLASS_BUTTON_CLASS } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import type { CollectionKind, PinnedTrack } from "../store/downloadsStore";
import {
  canDownloadHere,
  downloadCollection,
  removeCollectionDownload,
  useCollectionDownload,
} from "../hooks/useDownloads";

const DISARM_MS = 3000;

function ProgressRing({ value }: { value: number }) {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={
          circumference * (1 - Math.min(1, Math.max(0.04, value)))
        }
        transform="rotate(-90 10 10)"
        className="transition-[stroke-dashoffset] duration-300"
      />
      <path
        d="M10 6.5v6m0 0-2.4-2.4M10 12.5l2.4-2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Hero toggle for a playlist or album, like the one people know from other
 * players: tap to download it, see it fill up, tap twice to take it off the
 * device. Pinned playlists keep following the playlist as it changes.
 */
export function DownloadToggleButton({
  id,
  kind,
  title,
  coverUrl,
  tracks,
  className,
}: {
  id: string;
  kind: CollectionKind;
  title: string;
  coverUrl: string;
  tracks: PinnedTrack[];
  className?: string;
}) {
  const { t } = useTranslation();
  const status = useCollectionDownload(id, tracks);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!canDownloadHere()) return null;

  const label = armed
    ? t("downloads.remove_confirm")
    : status.pinned
      ? status.complete
        ? t("downloads.downloaded")
        : t("downloads.downloading", {
            done: status.downloaded,
            total: status.total,
          })
      : t("downloads.download");

  const onClick = () => {
    if (!status.pinned) {
      downloadCollection({ id, kind, title, coverUrl, tracks }, t);
      return;
    }
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), DISARM_MS);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    removeCollectionDownload(id, title, t);
  };

  return (
    <Button
      variant="secondary"
      disabled={status.total === 0}
      onClick={onClick}
      onMouseLeave={() => setArmed(false)}
      title={label}
      aria-label={label}
      aria-pressed={status.pinned}
      className={cn(
        HERO_BUTTON_CLASS,
        HERO_GLASS_BUTTON_CLASS,
        "!w-[52px] !p-0 transition-colors",
        armed
          ? "!bg-[#ff3b30] !text-white"
          : status.pinned && status.complete
            ? "!text-emerald-400"
            : "text-text-primary",
        className,
      )}
    >
      {status.pinned && !armed ? (
        status.complete ? (
          <CheckCircleFill size={20} />
        ) : (
          <ProgressRing
            value={status.total ? status.downloaded / status.total : 0}
          />
        )
      ) : (
        <DownloadLine size={20} />
      )}
    </Button>
  );
}
