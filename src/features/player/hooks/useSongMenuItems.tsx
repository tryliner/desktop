import { useCallback } from "react";
import {
  LuRadio,
  LuStepForward,
  LuListPlus,
  LuHeart,
  LuPlus,
  LuTrash2,
  LuFolderPlus,
  LuPencil,
} from "react-icons/lu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { playerEngine } from "../engine/playerEngine";
import {
  usePlaylistsList,
  useLikeTrack,
  useUnlikeTrack,
  useIsTrackLiked,
  useModalStore,
} from "@/features/library";
import { useTranslation } from "@/languages";
import { showToast } from "@/shared/ui";
import { linerDb } from "@/shared/storage";

export interface SongMenuContext {
  id?: string;
  title: string;
  artists: string;
  coverUrl: string;
  duration?: string;
  durationMs?: number;
  searchType?: "track" | "album" | "artist" | "playlist";
  totalTracks?: number;
  playlistId?: string;
  playlistItemId?: string;
  playlistTitle?: string;
  albumTitle?: string;
}

export function useSongMenuItems(ctx: SongMenuContext): DropdownMenuItem[] {
  const { t } = useTranslation();
  const {
    id,
    title,
    artists,
    coverUrl,
    duration,
    durationMs,
    searchType,
    totalTracks,
    playlistId,
    playlistItemId,
    playlistTitle,
    albumTitle,
  } = ctx;

  const { data: playlistsData } = usePlaylistsList();

  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();

  const liked = useIsTrackLiked(id);

  const handleLike = useCallback(async () => {
    if (!id) return;
    if (liked) {
      unlikeMutation.mutate(id);
    } else {
      likeMutation.mutate(id);
    }
  }, [id, liked, likeMutation, unlikeMutation]);

  const buildMenu = useCallback((): DropdownMenuItem[] => {
    const isTrack = searchType === "track" || !searchType;

    if (isTrack) {
      const isLocal = Boolean(id?.startsWith("local_"));

      if (playlistId === "cached") {
        const items: DropdownMenuItem[] = [];

        if (!isLocal) {
          items.push({
            id: "start-radio",
            label: t("common.start_radio"),
            icon: <LuRadio size={15} />,
            onClick: () => {
              if (!id) return;
              void playerEngine.startRadioStation({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
            },
          });
        }

        items.push(
          {
            id: "play-next",
            label: t("common.play_next"),
            icon: <LuStepForward size={15} />,
            onClick: () => {
              if (!id) return;
              playerEngine.playNext({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
            },
          },
          {
            id: "add-to-queue",
            label: t("common.add_to_queue"),
            icon: <LuListPlus size={15} />,
            onClick: () => {
              if (!id) return;
              playerEngine.addToQueue({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
              showToast(t("common.added_to_queue"), "checkmark", {
                description: artists ? `${title} — ${artists}` : title,
              });
            },
          },
        );

        if (!isLocal) {
          items.push({
            id: liked ? "unlike-track" : "like-track",
            label: liked ? t("common.unlike") : t("common.like"),
            icon: (
              <LuHeart
                size={15}
                className={liked ? "fill-red-500 text-red-500" : "text-text-secondary"}
              />
            ),
            onClick: handleLike,
          });
        }

        items.push({
          id: "add-to-playlist",
          label: t("common.add_to_playlist"),
          icon: <LuPlus size={15} />,
          onClick: () => {
            if (!id) return;
            useModalStore.getState().openAddToPlaylist({
              id,
              title,
              artists,
              coverUrl,
              duration,
              playlists: playlistsData?.playlists ?? [],
            });
          },
        });

        if (isLocal) {
          items.push({
            id: "edit-metadata",
            label: t("common.edit_info"),
            icon: <LuPencil size={15} />,
            onClick: () => {
              if (!id) return;
              useModalStore.getState().openEditTrackMetadata({
                id,
                title,
                artists,
                albumTitle: albumTitle || "",
                coverUrl,
                durationMs: durationMs ?? 0,
              });
            },
          });
        }

        items.push({
          id: "remove-from-cache",
          label: t("playlist.remove_from_cache"),
          icon: <LuTrash2 size={15} />,
          danger: true,
          onClick: async () => {
            if (!id) return;
            await linerDb.deleteCachedTrack(id);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("liner:cache_changed"));
            }
            showToast(t("playlist.removed_from_cache"), "checkmark", {
              description: artists ? `${title} — ${artists}` : title,
            });
          },
        });

        return items;
      }

      if (playlistId) {
        const items: DropdownMenuItem[] = [];

        if (!isLocal) {
          items.push({
            id: "start-radio",
            label: t("common.start_radio"),
            icon: <LuRadio size={15} />,
            onClick: () => {
              if (!id) return;
              void playerEngine.startRadioStation({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
            },
          });
        }

        items.push(
          {
            id: "play-next",
            label: t("common.play_next"),
            icon: <LuStepForward size={15} />,
            onClick: () => {
              if (!id) return;
              playerEngine.playNext({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
            },
          },
          {
            id: "add-to-queue",
            label: t("common.add_to_queue"),
            icon: <LuListPlus size={15} />,
            onClick: () => {
              if (!id) return;
              playerEngine.addToQueue({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
              showToast(t("common.added_to_queue"), "checkmark", {
                description: artists ? `${title} — ${artists}` : title,
              });
            },
          },
        );

        if (!isLocal) {
          items.push({
            id: liked ? "unlike-track" : "like-track",
            label: liked ? t("common.unlike") : t("common.like"),
            icon: (
              <LuHeart
                size={15}
                className={liked ? "fill-red-500 text-red-500" : "text-text-secondary"}
              />
            ),
            onClick: handleLike,
          });
        }

        items.push({
          id: "add-to-playlist",
          label: t("common.add_to_playlist"),
          icon: <LuPlus size={15} />,
          onClick: () => {
            if (!id) return;
            useModalStore.getState().openAddToPlaylist({
              id,
              title,
              artists,
              coverUrl,
              duration,
              playlists: playlistsData?.playlists ?? [],
            });
          },
        });

        if (isLocal) {
          items.push({
            id: "edit-metadata",
            label: t("common.edit_info"),
            icon: <LuPencil size={15} />,
            onClick: () => {
              if (!id) return;
              useModalStore.getState().openEditTrackMetadata({
                id,
                title,
                artists,
                albumTitle: albumTitle || "",
                coverUrl,
                durationMs: durationMs ?? 0,
              });
            },
          });
        }

        items.push({
          id: "remove-from-playlist",
          label: t("common.remove_from_playlist"),
          icon: <LuTrash2 size={15} />,
          danger: true,
          onClick: () => {
            if (!id) return;
            useModalStore.getState().openRemoveFromPlaylist({
              trackId: id,
              playlistItemId,
              trackTitle: title,
              trackArtists: artists,
              trackCoverUrl: coverUrl,
              playlistId,
              playlistTitle,
            });
          },
        });

        return items;
      }

      const items: DropdownMenuItem[] = [];

      if (!isLocal) {
        items.push({
          id: "start-radio",
          label: t("common.start_radio"),
          icon: <LuRadio size={15} />,
          onClick: () => {
            if (!id) return;
            void playerEngine.startRadioStation({
              id,
              title,
              artists,
              coverUrl,
              durationMs: durationMs ?? 0,
              playCount: 0,
            });
          },
        });
      }

      items.push(
        {
          id: "play-next",
          label: t("common.play_next"),
          icon: <LuStepForward size={15} />,
          onClick: () => {
            if (!id) return;
            playerEngine.playNext({
              id,
              title,
              artists,
              coverUrl,
              durationMs: durationMs ?? 0,
              playCount: 0,
            });
          },
        },
        {
          id: "add-to-queue",
          label: t("common.add_to_queue"),
          icon: <LuListPlus size={15} />,
          onClick: () => {
            if (!id) return;
            playerEngine.addToQueue({
              id,
              title,
              artists,
              coverUrl,
              durationMs: durationMs ?? 0,
              playCount: 0,
            });
            showToast(t("common.added_to_queue"), "checkmark", {
              description: artists ? `${title} — ${artists}` : title,
            });
          },
        },
      );

      if (!isLocal) {
        items.push({
          id: liked ? "unlike-track" : "like-track",
          label: liked ? t("common.unlike") : t("common.like"),
          icon: (
            <LuHeart
              size={15}
              className={liked ? "fill-red-500 text-red-500" : "text-text-secondary"}
            />
          ),
          onClick: handleLike,
        });
      }

      items.push({
        id: "add-to-playlist",
        label: t("common.add_to_playlist"),
        icon: <LuPlus size={15} />,
        onClick: () => {
          if (!id) return;
          useModalStore.getState().openAddToPlaylist({
            id,
            title,
            artists,
            coverUrl,
            duration,
            playlists: playlistsData?.playlists ?? [],
          });
        },
      });

      if (isLocal) {
        items.push({
          id: "edit-metadata",
          label: t("common.edit_info"),
          icon: <LuPencil size={15} />,
          onClick: () => {
            if (!id) return;
            useModalStore.getState().openEditTrackMetadata({
              id,
              title,
              artists,
              albumTitle: albumTitle || "",
              coverUrl,
              durationMs: durationMs ?? 0,
            });
          },
        });
      }

      return items;
    }

    return [
      {
        id: "add-to-library",
        label: t("common.add_to_library"),
        icon: <LuFolderPlus size={15} />,
        onClick: () => {
          if (!id) return;
          useModalStore.getState().openAddToLibrary({
            id,
            title,
            coverUrl,
            type: (searchType as "album" | "artist" | "playlist") || "album",
            subtitle: artists,
            totalTracks,
          });
        },
      },
    ];
  }, [
    id,
    title,
    artists,
    albumTitle,
    coverUrl,
    duration,
    durationMs,
    searchType,
    totalTracks,
    playlistId,
    playlistItemId,
    playlistTitle,
    liked,
    handleLike,
    playlistsData,
    t,
  ]);

  return buildMenu();
}
