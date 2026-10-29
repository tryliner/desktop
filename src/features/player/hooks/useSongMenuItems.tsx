import { useCallback } from "react";
import {
  LuRadio,
  LuStepForward,
  LuListPlus,
  LuHeart,
  LuPlus,
  LuTrash2,
  LuFolderPlus,
} from "react-icons/lu";
import { ShareForwardLine } from "@mingcute/react";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { playerEngine } from "../engine/playerEngine";
import {
  usePlaylistsList,
  useIsTrackLiked,
  useModalStore,
} from "@/features/library";
import { useLikeTrack } from "@/features/library/hooks/likes/useLikeTrack";
import { useUnlikeTrack } from "@/features/library/hooks/likes/useUnlikeTrack";
import { useTranslation } from "@/languages";
import { showToast } from "@/shared/ui";
import { buildShareUrl } from "@/shared/utils/share";
import { isLocalTrackId } from "@/shared/media/local";

const CLOUD_ONLY_ITEMS = new Set([
  "start-radio",
  "like-track",
  "unlike-track",
  "add-to-playlist",
  "remove-from-playlist",
  "share",
]);

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
  /** play queue rows: adds "Remove from queue" (the queue animates the row out) */
  onRemoveFromQueue?: () => void;
  onRemoveFromDevice?: () => void;
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
    onRemoveFromQueue,
    onRemoveFromDevice,
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

  const handleShare = useCallback(() => {
    if (!id) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      const type =
        (searchType as "track" | "album" | "artist" | "playlist") || "track";
      void navigator.clipboard.writeText(buildShareUrl(type, id));
      showToast(t("common.link_copied"), "checkmark", {
        description: artists ? `${title} — ${artists}` : title,
      });
    }
  }, [id, searchType, title, artists, t]);

  const buildMenu = useCallback((): DropdownMenuItem[] => {
    const isTrack = searchType === "track" || !searchType;

    if (isTrack) {
      if (playlistId) {
        return [
          {
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
          },
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
          {
            id: liked ? "unlike-track" : "like-track",
            label: liked ? t("common.unlike") : t("common.like"),
            icon: (
              <LuHeart
                size={15}
                className={
                  liked ? "fill-red-500 text-red-500" : "text-text-secondary"
                }
              />
            ),
            onClick: handleLike,
          },
          {
            id: "share",
            label: t("common.share"),
            icon: <ShareForwardLine size={15} />,
            onClick: handleShare,
          },
          {
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
          },
        ];
      }

      return [
        {
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
        },
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
        {
          id: liked ? "unlike-track" : "like-track",
          label: liked ? t("common.unlike") : t("common.like"),
          icon: (
            <LuHeart
              size={15}
              className={
                liked ? "fill-red-500 text-red-500" : "text-text-secondary"
              }
            />
          ),
          onClick: handleLike,
        },
        {
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
        },
        {
          id: "share",
          label: t("common.share"),
          icon: <ShareForwardLine size={15} />,
          onClick: handleShare,
        },
        ...(onRemoveFromQueue
          ? [
              {
                id: "remove-from-queue",
                label: t("common.remove_from_queue"),
                icon: <LuTrash2 size={15} />,
                danger: true,
                onClick: onRemoveFromQueue,
              },
            ]
          : []),
      ];
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
      {
        id: "share",
        label: t("common.share"),
        icon: <ShareForwardLine size={15} />,
        onClick: handleShare,
      },
    ];
  }, [
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
    onRemoveFromQueue,
    liked,
    handleLike,
    handleShare,
    playlistsData,
    t,
  ]);

  const items = buildMenu();
  if (!isLocalTrackId(id)) return items;
  const deviceItems = items.filter((item) => !CLOUD_ONLY_ITEMS.has(item.id));
  if (!onRemoveFromDevice) return deviceItems;
  return [
    ...deviceItems,
    {
      id: "remove-from-device",
      label: t("library.local.remove"),
      icon: <LuTrash2 size={15} />,
      danger: true,
      onClick: onRemoveFromDevice,
    },
  ];
}
