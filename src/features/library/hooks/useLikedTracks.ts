import { useEffect, useSyncExternalStore } from "react";
import type { Track } from "@/shared/types";
import {
  SERVER_SNAPSHOT,
  snapshotLikedTracks,
  subscribeLikedTracks,
  likedTracksSnapshot as getLikedTracksSnapshot,
} from "./likedTrackStore";
import { loadLikedTracks, reloadLikedTracks } from "./likedTrackLoader";

export {
  isTrackLikedNow,
  setTrackLiked,
  toggleTrackLike,
} from "./likedTrackMutations";
export {
  applyOptimisticLike,
  applyOptimisticUnlike,
} from "./likedTrackOptimistic";
export {
  reloadLikedTracks,
  loadLikedTracks,
};
export { subscribeLikedTracks } from "./likedTrackStore";
export type { LikeTarget } from "./likedTrackMatching";

export function likedTracksSnapshot(): {
  tracks: Track[];
  fromServer: boolean;
} {
  return getLikedTracksSnapshot();
}

export function useLikedTracks(_params?: { limit?: number; offset?: number }) {
  const state = useSyncExternalStore(
    subscribeLikedTracks,
    snapshotLikedTracks,
    () => SERVER_SNAPSHOT,
  );
  useEffect(() => {
    void loadLikedTracks();
  }, []);
  return state;
}

export function useLikedTrackCount() {
  const { data, isLoading } = useLikedTracks();
  return { data: data.total, isLoading };
}
