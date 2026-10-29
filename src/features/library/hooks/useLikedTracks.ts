import { useEffect, useSyncExternalStore } from "react";
import { getAuthSession } from "@/shared/api";
import {
  captureScope,
  isScopeActive,
  onAccountChange,
  syncAccountScope,
} from "./likes/accountScope";
import { buildLikedView, type LikedData } from "./likes/buildLikedView";
import { fetchLikedTracks } from "./likes/fetchLikedTracks";
import {
  currentSettleSeq,
  onOverridesChange,
  reconcileOverrides,
} from "./likes/optimisticLikes";

const EMPTY: LikedData = { tracks: [], total: 0 };
let cache: LikedData = EMPTY;
let loaded = false;
let request: Promise<void> | null = null;
let refetchQueued = false;
const listeners = new Set<() => void>();
let view = { data: cache, isLoading: true };

function emit(isLoading = false) {
  view = buildLikedView(cache, isLoading);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return view;
}

onOverridesChange(() => emit(false));

onAccountChange(() => {
  cache = EMPTY;
  loaded = false;
  emit(false);
});

const SERVER_SNAPSHOT = { data: EMPTY, isLoading: true };

function load(force = false): Promise<void> {
  if (request) {
    if (force) refetchQueued = true;
    return request;
  }
  const scope = captureScope();
  if (!getAuthSession()?.accessToken || !scope) {
    cache = EMPTY;
    loaded = false;
    emit(false);
    return Promise.resolve();
  }
  if (loaded && !force) return Promise.resolve();

  if (!loaded) emit(true);

  const startSeq = currentSettleSeq();

  request = (async () => {
    const tracks = await fetchLikedTracks(scope);
    if (!tracks) {
      refetchQueued = true;
      return;
    }
    cache = { tracks, total: tracks.length };
    loaded = true;
    reconcileOverrides(startSeq);
  })()
    .catch(() => {
      if (!isScopeActive(scope)) {
        refetchQueued = true;
        return;
      }
      if (!loaded) cache = EMPTY;
      loaded = true;
    })
    .finally(() => {
      request = null;
      emit(false);
      if (refetchQueued) {
        refetchQueued = false;
        void load(true);
      }
    });
  return request;
}

if (typeof window !== "undefined") {
  const handleRefresh = () => {
    syncAccountScope();
    const session = getAuthSession();
    if (!session?.accessToken) {
      cache = EMPTY;
      loaded = false;
      emit(false);
    } else {
      void load(true);
    }
  };
  window.addEventListener("library:changed", handleRefresh);
  window.addEventListener("auth:changed", handleRefresh);
}

export function useLikedTracks(_params?: { limit?: number; offset?: number }) {
  const state = useSyncExternalStore(
    subscribe,
    snapshot,
    () => SERVER_SNAPSHOT,
  );
  useEffect(() => {
    void load();
  }, []);
  return state;
}

export function useLikedTrackCount() {
  const { data, isLoading } = useLikedTracks();
  return { data: data.total, isLoading };
}
