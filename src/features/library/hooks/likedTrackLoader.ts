import { api, getAuthSession, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";
import {
  clearLikedCache,
  dropConfirmedOverrides,
  emitLikedTracks,
  getAuthGeneration,
  getLikedSyncEpoch,
  likedWasFetchedFromServer,
  optimisticOverrides,
  optimisticTracks,
  likeSettledEpoch,
  setLikedCache,
  setLikedLoadFailed,
  setActiveAuthOwner,
} from "./likedTrackStore";

let loaded = false;
let request: Promise<void> | null = null;
let reloadQueued = false;
let requestOwner: string | null = null;
let activeOwner: string | null = null;
let reloadPromise: Promise<void> | null = null;
let resolveReloadPromise: (() => void) | null = null;

function beginForcedReload(): Promise<void> {
  if (reloadPromise) return reloadPromise;
  reloadPromise = new Promise<void>((resolve) => {
    resolveReloadPromise = resolve;
  });
  return reloadPromise;
}

function finishForcedReload() {
  resolveReloadPromise?.();
  resolveReloadPromise = null;
  reloadPromise = null;
}

export function loadLikedTracks(force = false): Promise<void> {
  const session = getAuthSession();
  const owner = session?.accessToken ? (session.user?.id ?? null) : null;
  if (owner !== activeOwner) {
    setActiveAuthOwner(owner);
    activeOwner = owner;
    loaded = false;
  }
  if (!session?.accessToken) {
    clearLikedCache();
    loaded = false;
    optimisticOverrides.clear();
    optimisticTracks.clear();
    likeSettledEpoch.clear();
    emitLikedTracks(false);
    finishForcedReload();
    return Promise.resolve();
  }
  if (request) {
    if (force || owner !== requestOwner) {
      reloadQueued = true;
      if (force) return beginForcedReload();
    }
    return request;
  }
  if (loaded && !force) return Promise.resolve();
  if (!loaded) emitLikedTracks(true);

  const startEpoch = getLikedSyncEpoch();
  const startGeneration = getAuthGeneration();
  requestOwner = owner;
  request = (async () => {
    const tracks: Track[] = [];
    let cursor: string | undefined;
    do {
      const page = await api.listLikedTracks(100, cursor);
      tracks.push(
        ...page.items.map(({ track, likedAt }) => ({
          ...toClientTrack(track),
          addedAt: likedAt,
        })),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    if (
      getAuthGeneration() !== startGeneration ||
      (getAuthSession()?.user?.id ?? null) !== owner
    )
      return;
    setLikedCache(tracks, true);
    loaded = true;
    setLikedLoadFailed(false);
    dropConfirmedOverrides(startEpoch);
  })()
    .catch(() => {
      if (
        getAuthGeneration() !== startGeneration ||
        (getAuthSession()?.user?.id ?? null) !== owner
      )
        return;
      if (!likedWasFetchedFromServer()) clearLikedCache();
      loaded = likedWasFetchedFromServer();
      setLikedLoadFailed(true);
    })
    .finally(() => {
      request = null;
      emitLikedTracks(false);
      if (reloadQueued) {
        reloadQueued = false;
        void loadLikedTracks(true);
      } else {
        finishForcedReload();
      }
    });
  return reloadPromise ?? request;
}

export function reloadLikedTracks() {
  return loadLikedTracks(true);
}

if (typeof window !== "undefined") {
  const handleRefresh = () => void loadLikedTracks(true);
  window.addEventListener("library:changed", handleRefresh);
  window.addEventListener("auth:changed", handleRefresh);
}
