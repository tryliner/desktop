import { memo, useCallback, useMemo, useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import SongCard from "@/features/player/ui/SongCard";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { showToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import type { Track } from "@/shared/types";
import { formatTrackDuration } from "../lib/formatLocalDurations";
import { useLocalPlaylistLinksStore } from "../store/localPlaylistLinksStore";

// dims the cover, title and duration, but not the menu button
const GREYED_OUT =
  "[&>div>div:first-child]:opacity-40 [&>div>div:first-child]:grayscale [&>div>div:first-child]:select-none [&>div>div:last-child>span]:opacity-40";

const MissingRow = memo(function MissingRow({
  playlistId,
  track,
}: {
  playlistId: string;
  track: Track;
}) {
  const { t } = useTranslation();
  const remove = useLocalPlaylistLinksStore((state) => state.remove);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const menuItems = useMemo<DropdownMenuItem[]>(
    () => [
      {
        id: "remove-from-playlist",
        label: t("common.remove_from_playlist"),
        icon: <LuTrash2 size={15} />,
        danger: true,
        onClick: () => {
          void remove(playlistId, track.id);
          showToast(t("common.removed_from_playlist"), "checkmark", {
            description: track.title || undefined,
          });
        },
      },
    ],
    [playlistId, track.id, track.title, remove, t],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  }, []);

  const handleMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
    if (!open) setMenuPosition(null);
  }, []);

  return (
    <div className={GREYED_OUT} title={t("library.local.missing")}>
      <SongCard
        id={track.id}
        title={track.title}
        artists={track.artists}
        artistsClickable={false}
        coverUrl=""
        duration={formatTrackDuration(track.durationMs)}
        menuItems={menuItems}
        menuOpen={menuOpen}
        onMenuOpenChange={handleMenuOpenChange}
        menuPosition={menuPosition}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
});

export default function MissingLocalTracks({
  playlistId,
  tracks,
}: {
  playlistId: string;
  tracks: Track[];
}) {
  if (tracks.length === 0) return null;
  return (
    <div className="flex flex-col">
      {tracks.map((track) => (
        <MissingRow key={track.id} playlistId={playlistId} track={track} />
      ))}
    </div>
  );
}
