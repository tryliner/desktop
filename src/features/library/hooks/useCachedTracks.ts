import { useEffect, useSyncExternalStore } from "react";
import { linerDb } from "@/shared/storage/linerDb";
import type { Track } from "@/shared/types";

type CachedData = { tracks: Track[]; total: number };
const EMPTY: CachedData = { tracks: [], total: 0 };

let cache: CachedData = EMPTY;
let loaded = false;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();
let view = { data: cache, isLoading: true };

function emit(isLoading = false) {
  view = { data: cache, isLoading };
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
  if (request && !force) return request;

  emit(!loaded);

  request = linerDb
    .getAllCachedTracks()
    .then((tracks) => {
      cache = { tracks, total: tracks.length };
      loaded = true;
      emit(false);
    })
    .catch((err) => {
      console.error("[useCachedTracks] Failed to load cached tracks:", err);
      cache = EMPTY;
      loaded = true;
      emit(false);
    })
    .finally(() => {
      request = null;
    });

  return request;
}

if (typeof window !== "undefined") {
  const handleRefresh = () => {
    void load(true);
  };
  window.addEventListener("liner:cache_changed", handleRefresh);
  window.addEventListener("storage:cache_cleared", handleRefresh);
}

export function useCachedTracks() {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    void load();
  }, []);
  return state;
}

export function useCachedTrackCount() {
  const { data, isLoading } = useCachedTracks();
  return { count: data.total, isLoading };
}

export async function removeCachedTrack(trackId: string): Promise<void> {
  await linerDb.deleteCachedTrack(trackId);
  void load(true);
}
