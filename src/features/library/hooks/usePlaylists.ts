import { useEffect, useState, useSyncExternalStore } from "react";
import { api, getAuthSession, mediaUrl, toClientTrack, type ApiUserPlaylistItem } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";
import type { Track } from "@/shared/types";
import {
  getOfflinePlaylists,
  getOfflinePlaylist,
  deleteOfflinePlaylist,
} from "@/shared/storage/offlinePlaylists";

export interface LibraryPlaylistSummary {
  id: string;
  title: string;
  description?: string;
  trackCount: number;
  coverUrl: string;
  coverUrls: string[];
  updatedAt: string;
  createdAt: string;
  revision: number;
  isOffline?: boolean;
}

export interface LibraryPlaylistDetail {
  id: string;
  title: string;
  description?: string;
  trackCount: number;
  coverUrl: string;
  coverUrls: string[];
  revision: number;
  tracks: Track[];
  isOffline?: boolean;
}

type PlaylistList = { playlists: LibraryPlaylistSummary[]; total: number };

const COVER_CACHE_KEY = "liner:playlist-covers-v2";
type CoverCacheEntry = { coverUrls: string[]; trackCount: number; updatedAt: string };
type CoverCache = Record<string, CoverCacheEntry>;

function readCoverCache(): CoverCache {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(COVER_CACHE_KEY) ?? "{}"); } catch { return {}; }
}

function writeCoverCache(c: CoverCache) {
  try { localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(c)); } catch {}
}

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
  if (id.startsWith("offline_pl_")) {
    deleteOfflinePlaylist(id);
  }
  cache = {
    playlists: cache.playlists.filter((p) => p.id !== id),
    total: Math.max(0, cache.total - 1),
  };
  queryCache.delete(`playlist:detail:${id}`);
  emit();
}

function emit() {
  view = { data: cache, error: undefined, isLoading: false };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return view;
}

const SERVER_SNAPSHOT = { data: EMPTY, error: undefined as unknown, isLoading: true };

function getOfflineSummaries(): LibraryPlaylistSummary[] {
  return getOfflinePlaylists().map((pl) => ({
    id: pl.id,
    title: pl.title,
    description: pl.description,
    trackCount: pl.tracks.length,
    coverUrl: pl.coverUrl || (pl.coverUrls && pl.coverUrls[0]) || "",
    coverUrls: pl.coverUrls || [],
    updatedAt: pl.updatedAt,
    createdAt: pl.createdAt,
    revision: 1,
    isOffline: true,
  }));
}

function load(force = false): Promise<void> {
  if (request) return request;
  const offlineList = getOfflineSummaries();
  const session = getAuthSession();
  if (!session?.accessToken) {
    cache = { playlists: offlineList, total: offlineList.length };
    loaded = true;
    emit();
    return Promise.resolve();
  }
  if (loaded && !force) return Promise.resolve();

  if (!loaded) {
    view = { data: { playlists: offlineList, total: offlineList.length }, error: undefined, isLoading: true };
    emit();
  }

  request = (async () => {
    const coverCache = readCoverCache();
    let serverPlaylists: LibraryPlaylistSummary[] = [];

    try {
      const response = await api.listPlaylists();

      serverPlaylists = await Promise.all(
        response.items.map(async (playlist) => {
          const cached = coverCache[playlist.id];

          if (cached && cached.updatedAt === playlist.updatedAt) {
            return {
              ...playlist,
              trackCount: cached.trackCount,
              coverUrl: cached.coverUrls[0] ?? "",
              coverUrls: cached.coverUrls,
            };
          }

          const detail = await api.getUserPlaylist(playlist.id);
          const covers = extractCovers(detail.items);
          const entry: CoverCacheEntry = {
            coverUrls: covers,
            trackCount: detail.items.length,
            updatedAt: playlist.updatedAt,
          };
          coverCache[playlist.id] = entry;
          return {
            ...playlist,
            trackCount: detail.items.length,
            coverUrl: covers[0] ?? "",
            coverUrls: covers,
          };
        })
      );

      const liveIds = new Set(response.items.map((p) => p.id));
      for (const id of Object.keys(coverCache)) {
        if (!liveIds.has(id)) delete coverCache[id];
      }
      writeCoverCache(coverCache);
    } catch (err) {
      console.warn("[usePlaylists] Failed to fetch server playlists, preserving offline/cached:", err);
      view.error = err;
    }

    const currentOffline = getOfflineSummaries();
    const combined = [...currentOffline, ...serverPlaylists];
    cache = { playlists: combined, total: combined.length };
    loaded = true;
  })()
    .catch((err) => {
      const currentOffline = getOfflineSummaries();
      cache = { playlists: currentOffline, total: currentOffline.length };
      loaded = true;
      view.error = err;
    })
    .finally(() => {
      request = null;
      emit();
    });
  return request;
}

if (typeof window !== "undefined") {
  const handleRefresh = () => {
    const session = getAuthSession();
    if (!session?.accessToken) {
      const offlineList = getOfflineSummaries();
      cache = { playlists: offlineList, total: offlineList.length };
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
  };
}

export function usePlaylistsList() {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    void load();
  }, []);
  return state;
}

export function usePlaylist(id: string | null) {
  const isOffline = Boolean(id?.startsWith("offline_pl_"));
  const cacheKey = id && !isOffline ? `playlist:detail:${id}` : null;
  const cached = cacheKey ? queryCache.get<LibraryPlaylistDetail>(cacheKey) : undefined;
  const [data, setData] = useState<LibraryPlaylistDetail | null>(() => {
    if (isOffline && id) {
      const pl = getOfflinePlaylist(id);
      if (pl) {
        return {
          id: pl.id,
          title: pl.title,
          description: pl.description,
          trackCount: pl.tracks.length,
          coverUrl: pl.coverUrl || (pl.coverUrls && pl.coverUrls[0]) || "",
          coverUrls: pl.coverUrls,
          revision: 1,
          tracks: pl.tracks,
          isOffline: true,
        };
      }
    }
    return cached ?? null;
  });
  const [error, setError] = useState<unknown>();
  const [isLoading, setIsLoading] = useState(!cached && Boolean(id) && !isOffline);

  useEffect(() => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }

    if (id.startsWith("offline_pl_")) {
      const loadOffline = () => {
        const pl = getOfflinePlaylist(id);
        if (pl) {
          setData({
            id: pl.id,
            title: pl.title,
            description: pl.description,
            trackCount: pl.tracks.length,
            coverUrl: pl.coverUrl || (pl.coverUrls && pl.coverUrls[0]) || "",
            coverUrls: pl.coverUrls,
            revision: 1,
            tracks: pl.tracks,
            isOffline: true,
          });
        } else {
          setData(null);
        }
        setIsLoading(false);
      };
      loadOffline();
      window.addEventListener("library:changed", loadOffline);
      return () => window.removeEventListener("library:changed", loadOffline);
    }

    const initial = cacheKey ? queryCache.get<LibraryPlaylistDetail>(cacheKey) : undefined;
    if (initial) {
      setData(initial);
      setIsLoading(false);
    } else {
      setData(null);
      setIsLoading(true);
    }
    let active = true;

    const fetchDetail = async (isBackground = false) => {
      if (!isBackground && cacheKey && !queryCache.get(cacheKey)) setIsLoading(true);
      try {
        const response = await api.getUserPlaylist(id);
        if (!active) return;

        const covers = extractCovers(response.items);

        const coverCache = readCoverCache();
        coverCache[id] = {
          coverUrls: covers,
          trackCount: response.items.length,
          updatedAt: response.playlist.updatedAt,
        };
        writeCoverCache(coverCache);

        const detail: LibraryPlaylistDetail = {
          id: response.playlist.id,
          title: response.playlist.title,
          description: response.playlist.description,
          trackCount: response.items.length,
          coverUrl: covers[0] ?? "",
          coverUrls: covers,
          revision: response.playlist.revision,
          tracks: response.items.map(toTrack),
        };
        if (cacheKey) queryCache.set(cacheKey, detail);
        setData(detail);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

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
