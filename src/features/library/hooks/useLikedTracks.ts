import { useEffect, useSyncExternalStore } from "react";
import { api, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";

type LikedData = { tracks: Track[]; total: number };
const EMPTY: LikedData = { tracks: [], total: 0 };
let cache: LikedData = EMPTY;
let loaded = false;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();
let view = { data: cache, isLoading: true };

const optimisticOverrides = new Map<string, boolean>();

function buildView(isLoading: boolean): { data: LikedData; isLoading: boolean } {
  if (optimisticOverrides.size === 0) return { data: cache, isLoading };

  let tracks = cache.tracks.filter(
    (t) => optimisticOverrides.get(t.id) !== false
  );
  for (const [id, liked] of optimisticOverrides) {
    if (liked && !tracks.some((t) => t.id === id)) {
      tracks = [
        {
          id,
          title: "",
          artists: "",
          artistId: undefined,
          coverUrl: "",
          durationMs: 0,
          playCount: 0,
        } as Track,
        ...tracks,
      ];
    }
  }
  return { data: { tracks, total: tracks.length }, isLoading };
}

function emit(isLoading = false) {
  view = buildView(isLoading);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return view;
}

const SERVER_SNAPSHOT = { data: EMPTY, isLoading: true };

function load(force = false): Promise<void> {
  if (request) return request;
  if (loaded && !force) return Promise.resolve();

  if (!loaded) emit(true);

  request = (async () => {
    const tracks: Track[] = [];
    let cursor: string | undefined;
    do {
      const page = await api.listLikedTracks(100, cursor);
      tracks.push(...page.items.map(({ track }) => toClientTrack(track)));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    cache = { tracks, total: tracks.length };
    loaded = true;
    optimisticOverrides.clear();
  })()
    .catch(() => {
      cache = EMPTY;
      loaded = true;
    })
    .finally(() => {
      request = null;
      emit(false);
    });
  return request;
}

export function applyOptimisticLike(trackId: string): () => void {
  const prev = optimisticOverrides.get(trackId);
  optimisticOverrides.set(trackId, true);
  emit(false);
  return () => {
    if (prev === undefined) optimisticOverrides.delete(trackId);
    else optimisticOverrides.set(trackId, prev);
    emit(false);
  };
}

export function applyOptimisticUnlike(trackId: string): () => void {
  const prev = optimisticOverrides.get(trackId);
  optimisticOverrides.set(trackId, false);
  emit(false);
  return () => {
    if (prev === undefined) optimisticOverrides.delete(trackId);
    else optimisticOverrides.set(trackId, prev);
    emit(false);
  };
}

if (typeof window !== "undefined") {
  const target = window as Window & { __linerLikedRefresh?: EventListener };
  if (target.__linerLikedRefresh)
    window.removeEventListener("library:changed", target.__linerLikedRefresh);
  target.__linerLikedRefresh = () => {
    loaded = false;
    void load(true);
  };
  window.addEventListener("library:changed", target.__linerLikedRefresh);
}

export function useLikedTracks(_params?: { limit?: number; offset?: number }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    void load();
  }, []);
  return state;
}

export function useLikedTrackCount() {
  const { data, isLoading } = useLikedTracks();
  return { data: data.total, isLoading };
}
