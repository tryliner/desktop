import { useMemo } from "react";
import { LuHeart, LuListPlus, LuPlus, LuX } from "react-icons/lu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { showToast } from "@/shared/ui";
import { useTranslation } from "@/languages";
import type { TFunction } from "@/languages";
import { api } from "@/shared/api";
import { isLocalTrackId } from "@/shared/media/local";
import {
  notifyLibraryChanged,
  setTrackLiked,
  toTrackDetails,
  useModalStore,
} from "@/features/library";
import { playerEngine } from "../engine/playerEngine";
import {
  selectedTracks,
  useTrackSelectionStore,
  type SelectableTrack,
} from "../store/trackSelectionStore";

function cloudOnly(tracks: SelectableTrack[]) {
  return tracks.filter((track) => !isLocalTrackId(track.id));
}

function current() {
  const state = useTrackSelectionStore.getState();
  return { state, tracks: selectedTracks(state) };
}

/**
 * Bulk actions over the current multi-selection. They read the store when
 * they run, so menus and the bar don't have to re-render to stay correct.
 */
export const selectionActions = {
  addToPlaylist(t: TFunction) {
    const { tracks } = current();
    const cloud = cloudOnly(tracks);
    if (cloud.length === 0) {
      showToast(
        t("playlist_picker.local_skipped", { count: tracks.length }),
        "info",
      );
      return;
    }
    useModalStore.getState().openAddToPlaylist(toTrackDetails(cloud));
  },

  addToQueue(t: TFunction) {
    const { state, tracks } = current();
    for (const track of tracks) {
      playerEngine.addToQueue({ ...track, playCount: 0 });
    }
    showToast(
      t("selection.added_to_queue", { count: tracks.length }),
      "checkmark",
    );
    state.clear();
  },

  likeAll(t: TFunction) {
    const { state, tracks } = current();
    const cloud = cloudOnly(tracks);
    void Promise.allSettled(
      cloud.map((track) => setTrackLiked(track.id, true)),
    );
    showToast(t("selection.liked", { count: cloud.length }), "checkmark");
    state.clear();
  },

  async removeFromPlaylist(t: TFunction) {
    const { state, tracks } = current();
    const { playlistId, playlistTitle } = state.meta;
    if (!playlistId) return;
    const items = tracks.filter((track) => track.playlistItemId);
    state.clear();
    const results = await Promise.allSettled(
      items.map((track) =>
        api.removePlaylistItem(playlistId, track.playlistItemId!),
      ),
    );
    notifyLibraryChanged();
    const removed = results.filter((r) => r.status === "fulfilled").length;
    if (removed > 0) {
      showToast(t("selection.removed", { count: removed }), "checkmark", {
        description: playlistTitle,
      });
    }
    if (removed < items.length) {
      showToast(t("common.failed_to_remove_track"), "error");
    }
  },

  clear() {
    useTrackSelectionStore.getState().clear();
  },
};

/** reactive summary for the floating selection bar */
export function useSelectionSummary() {
  const keys = useTrackSelectionStore((s) => s.keys);
  const tracksByKey = useTrackSelectionStore((s) => s.tracks);
  const meta = useTrackSelectionStore((s) => s.meta);
  return useMemo(() => {
    const tracks = selectedTracks({ keys, tracks: tracksByKey });
    const localCount = tracks.length - cloudOnly(tracks).length;
    return {
      tracks,
      count: tracks.length,
      localCount,
      canRemove: Boolean(
        meta.playlistId && tracks.some((track) => track.playlistItemId),
      ),
    };
  }, [keys, tracksByKey, meta.playlistId]);
}

/**
 * Context menu for a row that's part of a selection of 2+: every action
 * applies to the whole selection. `null` means "use the row's own menu".
 */
export function useSelectionMenuItems(
  rowSelected: boolean,
): DropdownMenuItem[] | null {
  const { t } = useTranslation();
  // rows outside the selection subscribe to a constant, so they never re-render
  const count = useTrackSelectionStore((s) =>
    rowSelected ? s.keys.length : 0,
  );
  return useMemo(() => {
    if (count < 2) return null;
    return [
      {
        id: "selection-add-to-playlist",
        label: `${t("selection.add_to_playlist")} (${count})`,
        icon: <LuPlus size={15} />,
        onClick: () => selectionActions.addToPlaylist(t),
      },
      {
        id: "selection-add-to-queue",
        label: `${t("selection.add_to_queue")} (${count})`,
        icon: <LuListPlus size={15} />,
        onClick: () => selectionActions.addToQueue(t),
      },
      {
        id: "selection-like",
        label: `${t("selection.like")} (${count})`,
        icon: <LuHeart size={15} />,
        onClick: () => selectionActions.likeAll(t),
      },
      {
        id: "selection-clear",
        label: t("selection.clear"),
        icon: <LuX size={15} />,
        separator: true,
        onClick: selectionActions.clear,
      },
    ];
  }, [count, t]);
}
