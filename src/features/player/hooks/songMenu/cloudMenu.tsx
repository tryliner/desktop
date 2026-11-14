import { LuPlus, LuTrash2, LuFolderPlus } from "react-icons/lu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { useModalStore } from "@/features/library";
import { likeItem, playbackItems, shareItem } from "./trackItems";
import type { SongMenuActions, SongMenuContext, Translate } from "./types";

function removeFromPlaylistItem(
  ctx: SongMenuContext,
  playlistId: string,
  t: Translate,
): DropdownMenuItem {
  return {
    id: "remove-from-playlist",
    label: t("common.remove_from_playlist"),
    icon: <LuTrash2 size={15} />,
    danger: true,
    onClick: () => {
      if (!ctx.id) return;
      useModalStore.getState().openRemoveFromPlaylist({
        trackId: ctx.id,
        playlistItemId: ctx.playlistItemId,
        trackTitle: ctx.title,
        trackArtists: ctx.artists,
        trackCoverUrl: ctx.coverUrl,
        playlistId,
        playlistTitle: ctx.playlistTitle,
      });
    },
  };
}

function addToPlaylistItem(
  ctx: SongMenuContext,
  actions: SongMenuActions,
  t: Translate,
): DropdownMenuItem {
  return {
    id: "add-to-playlist",
    label: t("common.add_to_playlist"),
    icon: <LuPlus size={15} />,
    onClick: () => {
      if (!ctx.id) return;
      useModalStore.getState().openAddToPlaylist({
        id: ctx.id,
        title: ctx.title,
        artists: ctx.artists,
        coverUrl: ctx.coverUrl,
        duration: ctx.duration,
        playlists: actions.playlistsData?.playlists ?? [],
      });
    },
  };
}

function addToLibraryItem(
  ctx: SongMenuContext,
  t: Translate,
): DropdownMenuItem {
  return {
    id: "add-to-library",
    label: t("common.add_to_library"),
    icon: <LuFolderPlus size={15} />,
    onClick: () => {
      if (!ctx.id) return;
      useModalStore.getState().openAddToLibrary({
        id: ctx.id,
        title: ctx.title,
        coverUrl: ctx.coverUrl,
        type: (ctx.searchType as "album" | "artist" | "playlist") || "album",
        subtitle: ctx.artists,
        totalTracks: ctx.totalTracks,
      });
    },
  };
}

export function buildCloudMenu(
  ctx: SongMenuContext,
  actions: SongMenuActions,
  t: Translate,
): DropdownMenuItem[] {
  const isTrack = ctx.searchType === "track" || !ctx.searchType;
  if (!isTrack) return [addToLibraryItem(ctx, t), shareItem(actions, t)];
  if (ctx.playlistId) {
    return [
      ...playbackItems(ctx, t),
      likeItem(actions, t),
      shareItem(actions, t),
      removeFromPlaylistItem(ctx, ctx.playlistId, t),
    ];
  }
  return [
    ...playbackItems(ctx, t),
    likeItem(actions, t),
    addToPlaylistItem(ctx, actions, t),
    shareItem(actions, t),
    ...(ctx.onRemoveFromQueue
      ? [
          {
            id: "remove-from-queue",
            label: t("common.remove_from_queue"),
            icon: <LuTrash2 size={15} />,
            danger: true,
            onClick: ctx.onRemoveFromQueue,
          },
        ]
      : []),
  ];
}
