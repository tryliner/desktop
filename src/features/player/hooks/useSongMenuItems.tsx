import { useCallback } from "react";
import {
  AddCircleFill,
  Delete2Fill,
  ForwardFill,
  HeartFill,
  NewFolderFill,
  Playlist2Fill,
} from "@mingcute/react";
import { Radio } from "@solar-icons/react";
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
      if (playlistId) {
        return [
          {
            id: "start-radio",
            label: t("common.start_radio"),
            icon: <Radio size={16} />,
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
            icon: <ForwardFill size={16} />,
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
            icon: <Playlist2Fill size={16} />,
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
            },
          },
          {
            id: liked ? "unlike-track" : "like-track",
            label: liked ? t("common.unlike") : t("common.like"),
            icon: (
              <HeartFill
                size={16}
                className={liked ? "text-[#ff4d4d]" : "text-text-secondary"}
              />
            ),
            onClick: handleLike,
          },
          {
            id: "remove-from-playlist",
            label: t("common.remove_from_playlist"),
            icon: <Delete2Fill size={16} />,
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
          icon: <Radio size={16} />,
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
          icon: <ForwardFill size={16} />,
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
          icon: <Playlist2Fill size={16} />,
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
          },
        },
        {
          id: liked ? "unlike-track" : "like-track",
          label: liked ? t("common.unlike") : t("common.like"),
          icon: (
            <HeartFill
              size={16}
              className={liked ? "text-[#ff4d4d]" : "text-text-secondary"}
            />
          ),
          onClick: handleLike,
        },
        {
          id: "add-to-playlist",
          label: t("common.add_to_playlist"),
          icon: <AddCircleFill size={16} />,
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
      ];
    }

    return [
      {
        id: "add-to-library",
        label: t("common.add_to_library"),
        icon: <NewFolderFill size={16} />,
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
