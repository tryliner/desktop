import { useEffect, useRef, useState } from "react";
import { CheckCircleFill, DownloadLine } from "@mingcute/react";
import Button from "@/shared/ui/Button";
import { HERO_BUTTON_CLASS, HERO_GLASS_BUTTON_CLASS } from "@/shared/ui";
import { useTranslation } from "@/languages";
import { cn } from "@/shared/lib";
import { ProgressRing } from "./ProgressRing";
import type { CollectionKind, PinnedTrack } from "../store/downloadsStore";
import {
  canDownloadHere,
  downloadCollection,
  removeCollectionDownload,
  useCollectionDownload,
} from "../hooks/useDownloads";

const DISARM_MS = 3000;

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
      disabled={status.total === 0 && !status.pinned}
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
