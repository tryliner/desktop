import { useEffect, useState, useSyncExternalStore } from "react";
import {
  api,
  getAuthSession,
  mediaUrl,
  toClientTrack,
  type ApiUserPlaylistDetails,
  type ApiUserPlaylistItem,
} from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";
import type { Track } from "@/shared/types";

export interface LibraryPlaylistSummary {
  id: string;
  title: string;
  description: string | null;
  trackCount: number;
  coverUrl: string;
  coverUrls: string[];
  updatedAt: string;
  createdAt: string;
  revision: number;
  isPublic: boolean;
}

export interface LibraryPlaylistDetail {
  id: string;
  title: string;
  description: string | null;
  trackCount: number;
  coverUrl: string;
  coverUrls: string[];
  revision: number;
  isPublic: boolean;
  tracks: Track[];
  durationMs?: number;
  partial?: boolean;
}

const FIRST_PAGE_SIZE = 100;

type PlaylistList = { playlists: LibraryPlaylistSummary[]; total: number };

function extractCovers(items: ApiUserPlaylistItem[]): string[] {
  return items
    .map((i) => (i.track.cover ? mediaUrl(i.track.cover.url) : ""))
    .filter(Boolean)
    .filter((url, idx, arr) => arr.indexOf(url) === idx)
    .slice(0, 4);
}

const EMPTY: PlaylistList = { playlists: [], total: 0 };
let cache = EMPTY;
let loaded = false;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();
let view = { data: cache, error: undefined as unknown, isLoading: true };

export function notifyLibraryChanged() {
  window.dispatchEvent(new Event("library:changed"));
}

// optimistically drop playlist from store so ui reacts instantly without waiting on network
export function evictPlaylistFromCache(id: string) {
  cache = {
    playlists: cache.playlists.filter((p) => p.id !== id),
    total: Math.max(0, cache.total - 1),
  };
  queryCache.delete(`playlist:detail:${id}`);
  queryCache.delete(`playlist:etag:${id}`);
  emit();
}

// the visibility shown in the list and the cached details before the server answers (or after it refused)
export function applyPlaylistVisibility(id: string, isPublic: boolean) {
  cache = {
    ...cache,
    playlists: cache.playlists.map((p) =>
      p.id === id ? { ...p, isPublic } : p,
    ),
  };
  const detailKey = `playlist:detail:${id}`;
  const detail = queryCache.get<LibraryPlaylistDetail>(detailKey);
  if (detail) queryCache.set(detailKey, { ...detail, isPublic });
  emit(view.error);
}

function emit(error?: unknown, isLoading = false) {
  view = { data: cache, error, isLoading };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return view;
}

const SERVER_SNAPSHOT = {
  data: EMPTY,
  error: undefined as unknown,
  isLoading: true,
};

function load(force = false): Promise<void> {
  if (request) return request;
  const session = getAuthSession();
  if (!session?.accessToken) {
    cache = EMPTY;
    loaded = false;
    emit();
    return Promise.resolve();
  }
  if (loaded && !force) return Promise.resolve();

  if (!loaded) emit(undefined, true);

  let failure: unknown;
  request = (async () => {
    const response = await api.listPlaylists();
    const playlists = response.items.map((playlist) => {
      const coverUrls = playlist.coverUrls
        .map((url) => mediaUrl(url))
        .filter(Boolean);
      return { ...playlist, coverUrl: coverUrls[0] ?? "", coverUrls };
    });

    cache = { playlists, total: playlists.length };
    loaded = true;
  })()
    .catch((err) => {
      if (!loaded) cache = EMPTY;
      loaded = true;
      failure = err;
    })
    .finally(() => {
      request = null;
      emit(failure);
    });
  return request;
}

if (typeof window !== "undefined") {
  const handleRefresh = () => {
    const session = getAuthSession();
    if (!session?.accessToken) {
      cache = EMPTY;
      loaded = false;
      emit();
    } else {
      void load(true);
    }
  };
  window.addEventListener("library:changed", handleRefresh);
  window.addEventListener("auth:changed", handleRefresh);
}

function toTrack(item: ApiUserPlaylistItem): Track {
  const base = toClientTrack(item.track);
  return {
    ...base,
    playlistItemId: item.id,
    addedAt: item.addedAt,
  };
}

export function usePlaylistsList() {
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

// `partial`: a first page, the rest of the items (nextCursor) is still loading
function toDetail({
  playlist,
  items,
  nextCursor,
}: ApiUserPlaylistDetails): LibraryPlaylistDetail {
  const covers = extractCovers(items);
  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    trackCount: playlist.trackCount,
    coverUrl: covers[0] ?? "",
    coverUrls: covers,
    revision: playlist.revision,
    isPublic: playlist.isPublic,
    tracks: items.map(toTrack),
    durationMs: playlist.durationMs,
    ...(nextCursor !== null ? { partial: true } : {}),
  };
}

export function usePlaylist(id: string | null) {
  const cacheKey = id ? `playlist:detail:${id}` : null;
  const cached = cacheKey
    ? queryCache.get<LibraryPlaylistDetail>(cacheKey)
    : undefined;
  const [data, setData] = useState<LibraryPlaylistDetail | null>(
    cached ?? null,
  );
  const [error, setError] = useState<unknown>();
  const [isLoading, setIsLoading] = useState(!cached && Boolean(id));

  useEffect(() => {
    if (!id || !cacheKey) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const initial = queryCache.get<LibraryPlaylistDetail>(cacheKey);
    if (initial) {
      setData(initial);
      setIsLoading(false);
    } else {
      setData(null);
      setIsLoading(true);
    }
    let active = true;

    const etagKey = `playlist:etag:${id}`;
    let complete = false;

    const fetchFirstPage = async () => {
      try {
        const response = await api.readUserPlaylist(id, {
          limit: FIRST_PAGE_SIZE,
        });
        if (!active || complete || response.notModified) return;
        const detail = toDetail(response);
        setData(detail);
        setIsLoading(false);
      } catch {}
    };

    const fetchDetail = async (isBackground = false) => {
      if (!isBackground && !queryCache.get(cacheKey)) setIsLoading(true);
      const etag = queryCache.get(cacheKey)
        ? queryCache.get<string>(etagKey)
        : undefined;
      try {
        const response = await api.readUserPlaylist(id, { etag });
        if (!active) return;
        complete = true;
        if (response.notModified) return;

        const detail = toDetail(response);
        queryCache.set(cacheKey, detail);
        if (response.etag) queryCache.set(etagKey, response.etag);
        else queryCache.delete(etagKey);
        setData(detail);
        setError(undefined);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    if (!initial) void fetchFirstPage();
    void fetchDetail(Boolean(initial));
    const refresh = () => void fetchDetail(true);
    window.addEventListener("library:changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("library:changed", refresh);
    };
  }, [id, cacheKey]);

  return { data, error, isLoading };
}
