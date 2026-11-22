import { api, getAuthSession, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";
import {
  clearLikedCache,
  dropConfirmedOverrides,
  emitLikedTracks,
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
    return Promise.resolve();
  }
  if (request) {
    if (force || owner !== requestOwner) reloadQueued = true;
    return request;
  }
  if (loaded && !force) return Promise.resolve();
  if (!loaded) emitLikedTracks(true);

  const startEpoch = getLikedSyncEpoch();
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
    if ((getAuthSession()?.user?.id ?? null) !== owner) return;
    setLikedCache(tracks, true);
    loaded = true;
    setLikedLoadFailed(false);
    dropConfirmedOverrides(startEpoch);
  })()
    .catch(() => {
      if ((getAuthSession()?.user?.id ?? null) !== owner) return;
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
      }
    });
  return request;
}

export function reloadLikedTracks() {
  return loadLikedTracks(true);
}

if (typeof window !== "undefined") {
  const handleRefresh = () => void loadLikedTracks(true);
  window.addEventListener("library:changed", handleRefresh);
  window.addEventListener("auth:changed", handleRefresh);
}
