import { api } from "@/shared/api";
import { notifyLibraryChanged } from "./usePlaylists";
import type { LikeTarget } from "./likedTrackMatching";
import {
  isTrackLikedNow,
  likeIdFor,
} from "./likedTrackResolver";
import {
  emitLikedTracks,
  incrementLikedSyncEpoch,
  getAuthGeneration,
  likeSettledEpoch,
  optimisticOverrides,
  optimisticTracks,
  syncingLikes,
} from "./likedTrackStore";

const desiredLikesByGeneration = new Map<string, boolean>();
const syncingGenerations = new Map<string, number>();
const likeWaiters = new Map<
  string,
  Array<{ resolve: () => void; reject: (error: unknown) => void }>
>();
const waiterKey = (generation: number, trackId: string) =>
  `${generation}:${trackId}`;

export { isTrackLikedNow } from "./likedTrackResolver";

function settleLikeWaiters(
  generation: number,
  trackId: string,
  error?: unknown,
) {
  const key = waiterKey(generation, trackId);
  const waiters = likeWaiters.get(key) ?? [];
  likeWaiters.delete(key);
  for (const waiter of waiters) {
    if (error === undefined) waiter.resolve();
    else waiter.reject(error);
  }
}

async function syncTrackLike(
  trackId: string,
  confirmed: boolean,
  generation: number,
) {
  syncingLikes.add(trackId);
  syncingGenerations.set(trackId, generation);
  let serverLiked = confirmed;
  let sent = false;
  let failure: unknown;
  try {
    for (;;) {
      const key = waiterKey(generation, trackId);
      const wanted = desiredLikesByGeneration.get(key);
      if (wanted === undefined || wanted === serverLiked) break;
      sent = true;
      if (wanted) await api.likeTrack(trackId);
      else await api.unlikeTrack(trackId);
      if (getAuthGeneration() !== generation) {
        desiredLikesByGeneration.delete(waiterKey(generation, trackId));
        if (syncingGenerations.get(trackId) === generation) {
          syncingLikes.delete(trackId);
          syncingGenerations.delete(trackId);
        }
        settleLikeWaiters(generation, trackId);
        return;
      }
      serverLiked = wanted;
    }
  } catch (error) {
    failure = error ?? new Error("like sync failed");
  }
  if (getAuthGeneration() !== generation) {
    desiredLikesByGeneration.delete(waiterKey(generation, trackId));
    if (syncingGenerations.get(trackId) === generation) {
      syncingLikes.delete(trackId);
      syncingGenerations.delete(trackId);
    }
    settleLikeWaiters(generation, trackId);
    return;
  }
  desiredLikesByGeneration.delete(waiterKey(generation, trackId));
  if (syncingGenerations.get(trackId) === generation) {
    syncingLikes.delete(trackId);
    syncingGenerations.delete(trackId);
  }
  const epoch = incrementLikedSyncEpoch();
  likeSettledEpoch.set(trackId, epoch);
  optimisticOverrides.set(trackId, serverLiked);
  if (!serverLiked) optimisticTracks.delete(trackId);
  emitLikedTracks(false);
  settleLikeWaiters(generation, trackId, failure);
  if (sent) notifyLibraryChanged();
}

export function setTrackLiked(
  target: LikeTarget,
  liked: boolean,
): Promise<void> {
  const trackId = likeIdFor(target);
  const generation = getAuthGeneration();
  const key = waiterKey(generation, trackId);
  const settled = new Promise<void>((resolve, reject) => {
    const waiters = likeWaiters.get(key) ?? [];
    waiters.push({ resolve, reject });
    likeWaiters.set(key, waiters);
  });
  const confirmed = isTrackLikedNow(target);
  desiredLikesByGeneration.set(key, liked);
  optimisticOverrides.set(trackId, liked);
  if (liked && typeof target !== "string") {
    optimisticTracks.set(trackId, target);
  }
  emitLikedTracks(false);
  if (
    !syncingLikes.has(trackId) ||
    syncingGenerations.get(trackId) !== generation
  ) {
    void syncTrackLike(trackId, confirmed, generation);
  }
  return settled;
}

export function toggleTrackLike(target: LikeTarget) {
  const liked = !isTrackLikedNow(target);
  return { liked, settled: setTrackLiked(target, liked) };
}
