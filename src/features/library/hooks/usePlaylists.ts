import { useEffect, useState, useSyncExternalStore } from "react";
import { api, mediaUrl, toClientTrack, type ApiUserPlaylistItem } from "@/shared/api";
import type { Track } from "@/shared/types";

export interface LibraryPlaylistSummary {
  id: string;
  title: string;
  trackCount: number;
  coverUrl: string;
  coverUrls: string[];
  updatedAt: string;
  createdAt: string;
  revision: number;
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

function load(force = false): Promise<void> {
  if (request) return request;
  if (loaded && !force) return Promise.resolve();

  if (!loaded) {
    view = { data: cache, error: undefined, isLoading: true };
    emit();
  }

  request = (async () => {
    const coverCache = readCoverCache();
    const response = await api.listPlaylists();

    const playlists = await Promise.all(
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

    cache = { playlists, total: playlists.length };
    loaded = true;
  })()
    .catch(() => {
      cache = EMPTY;
      loaded = true;
    })
    .finally(() => {
      request = null;
      emit();
    });
  return request;
}

if (typeof window !== "undefined") {
  const target = window as Window & { __linerPlaylistsRefresh?: EventListener };
  if (target.__linerPlaylistsRefresh)
    window.removeEventListener("library:changed", target.__linerPlaylistsRefresh);
  target.__linerPlaylistsRefresh = () => {
    loaded = false;
    void load(true);
  };
  window.addEventListener("library:changed", target.__linerPlaylistsRefresh);
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
  const [data, setData] = useState<LibraryPlaylistDetail | null>(null);
  const [error, setError] = useState<unknown>();
  const [isLoading, setIsLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let active = true;

    const fetchDetail = async () => {
      setIsLoading(true);
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

        setData({
          id: response.playlist.id,
          title: response.playlist.title,
          description: response.playlist.description,
          trackCount: response.items.length,
          coverUrl: covers[0] ?? "",
          coverUrls: covers,
          revision: response.playlist.revision,
          tracks: response.items.map(toTrack),
        });
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void fetchDetail();
    const refresh = () => void fetchDetail();
    window.addEventListener("library:changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("library:changed", refresh);
    };
  }, [id]);

  return { data, error, isLoading };
}
