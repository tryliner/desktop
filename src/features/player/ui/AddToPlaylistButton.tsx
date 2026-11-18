import { useMemo, useState } from "react";
import { AddLine } from "@mingcute/react";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import { useTranslation } from "@/languages";
import { isLocalTrackId } from "@/shared/media/local";
import { useModalStore, type TrackDetail } from "@/features/library";
import type { Track } from "@/shared/types";
import { useAddToPlaylistMenuItem } from "../hooks/useSongMenuItems";

interface AddToPlaylistButtonProps {
  track: Track | null | undefined;
  className?: string;
  iconSize?: number;
  /** which way the quick list opens; the player bar sits at the bottom */
  side?: "top" | "bottom";
  align?: "start" | "end";
}

/**
 * "+" next to the heart: opens the recent-playlists quick list, or the full
 * picker when there are no playlists yet. Hidden for local files, which can't
 * be added to a server playlist.
 */
export function AddToPlaylistButton({
  track,
  className,
  iconSize = 20,
  side = "top",
  align = "end",
}: AddToPlaylistButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const detail = useMemo<TrackDetail | null>(
    () =>
      track && !isLocalTrackId(track.id)
        ? {
            id: track.id,
            title: track.title,
            artists: track.artists,
            coverUrl: track.coverUrl,
            durationMs: track.durationMs,
          }
        : null,
    [track],
  );
  const item = useAddToPlaylistMenuItem(detail);
  if (!detail || !item) return null;

  const button = (
    <button
      type="button"
      aria-label={t("common.add_to_playlist")}
      title={t("common.add_to_playlist")}
      aria-haspopup={item.children ? "menu" : "dialog"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={
        item.children
          ? undefined
          : () => useModalStore.getState().openAddToPlaylist(detail)
      }
      className={className}
    >
      <AddLine size={iconSize} />
    </button>
  );

  if (!item.children) return button;

  return (
    <DropdownMenu
      trigger={button}
      items={item.children}
      open={open}
      onOpenChange={setOpen}
      side={side}
      align={align}
    />
  );
}
