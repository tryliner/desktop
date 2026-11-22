import type { Track } from "@/shared/types";

export type LikedData = { tracks: Track[]; total: number };
export const EMPTY: LikedData = { tracks: [], total: 0 };

let cache: LikedData = EMPTY;
let fetchedFromServer = false;
let loadFailed = false;
let view = { data: cache, isLoading: true, error: false };
let likeEpoch = 0;
let cacheOwner: string | null = null;
let authGeneration = 0;

export const optimisticOverrides = new Map<string, boolean>();
export const optimisticTracks = new Map<string, Track>();
export const syncingLikes = new Set<string>();
export const likeSettledEpoch = new Map<string, number>();
const listeners = new Set<() => void>();

export const SERVER_SNAPSHOT = { data: EMPTY, isLoading: true, error: false };

export function buildLikedView(isLoading: boolean) {
  if (optimisticOverrides.size === 0) {
    return { data: cache, isLoading, error: loadFailed };
  }
  let tracks = cache.tracks.filter(
    (track) => optimisticOverrides.get(track.id) !== false,
  );
  for (const [id, liked] of optimisticOverrides) {
    if (!liked || tracks.some((track) => track.id === id)) continue;
    const track = optimisticTracks.get(id);
    tracks = [
      track ? { ...track, id } : ({
        id,
        title: "",
        artists: "",
        coverUrl: "",
        durationMs: 0,
        playCount: 0,
      } as Track),
      ...tracks,
    ];
  }
  return { data: { tracks, total: tracks.length }, isLoading, error: loadFailed };
}

export function emitLikedTracks(isLoading = false) {
  view = buildLikedView(isLoading);
  listeners.forEach((listener) => listener());
}

export function subscribeLikedTracks(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshotLikedTracks() {
  return view;
}

export function getLikedCache() {
  return cache;
}

export function setLikedCache(tracks: Track[], fromServer = true) {
  cache = { tracks, total: tracks.length };
  fetchedFromServer = fromServer;
}

export function clearLikedCache() {
  cache = EMPTY;
  fetchedFromServer = false;
}

export function setLikedLoadFailed(failed: boolean) {
  loadFailed = failed;
}

export function likedWasFetchedFromServer() {
  return fetchedFromServer;
}

export function likedTracksSnapshot() {
  return { tracks: view.data.tracks, fromServer: fetchedFromServer };
}

export function getLikedSyncEpoch() {
  return likeEpoch;
}

export function incrementLikedSyncEpoch() {
  likeEpoch += 1;
  return likeEpoch;
}

export function dropConfirmedOverrides(startEpoch: number) {
  for (const id of optimisticOverrides.keys()) {
    if (syncingLikes.has(id)) continue;
    if ((likeSettledEpoch.get(id) ?? 0) > startEpoch) continue;
    optimisticOverrides.delete(id);
    likeSettledEpoch.delete(id);
  }
  for (const id of optimisticTracks.keys()) {
    if (!optimisticOverrides.has(id)) optimisticTracks.delete(id);
  }
}

export function getAuthGeneration() {
  return authGeneration;
}

export function setActiveAuthOwner(owner: string | null) {
  if (cacheOwner === owner) return false;
  cacheOwner = owner;
  authGeneration += 1;
  clearLikedCache();
  setLikedLoadFailed(false);
  optimisticOverrides.clear();
  optimisticTracks.clear();
  syncingLikes.clear();
  likeSettledEpoch.clear();
  emitLikedTracks(false);
  return true;
}
