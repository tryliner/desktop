import { useEffect, useState } from "react";
import { api } from "@/shared/api";
import type { PopularItem } from "./usePopularTracks";

const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { items: PopularItem[]; timestamp: number }>();

function useCachedItems(key: string, load: () => Promise<PopularItem[]>) {
  const [items, setItems] = useState<PopularItem[]>(
    () => cache.get(key)?.items ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => !cache.has(key));

  useEffect(() => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return;

    let active = true;
    load()
      .then((next) => {
        cache.set(key, { items: next, timestamp: Date.now() });
        if (active) setItems(next);
      })
      .catch(() => {
        if (active && !cache.has(key)) setItems([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [key, load]);

  return { items, isLoading };
}

const MIN_TOP_ALBUM_TRACKS = 5;
const TOP_ALBUMS_LIMIT = 20;

async function loadPopularAlbums(): Promise<PopularItem[]> {
  const response = await api.getPopularAlbums("7d", TOP_ALBUMS_LIMIT * 2);
  const fullAlbums = response.items
    .filter((album) => album.trackCount >= MIN_TOP_ALBUM_TRACKS)
    .slice(0, TOP_ALBUMS_LIMIT);
  return fullAlbums.map((album) => ({
    type: "album",
    item: {
      id: album.id,
      title: album.title,
      artist: album.artist,
      coverUrl: album.coverUrl ?? "",
      totalTracks: album.trackCount,
      albumType: "album",
    },
    playCount: album.playCount,
  }));
}

async function loadMostSaved(): Promise<PopularItem[]> {
  const response = await api.getMostSaved("all", 20);
  return response.items.map((entry): PopularItem =>
    entry.type === "album"
      ? {
          type: "album",
          item: {
            id: entry.id,
            title: entry.title,
            artist: entry.subtitle,
            coverUrl: entry.coverUrl ?? "",
            totalTracks: 0,
            albumType: "album",
          },
          playCount: entry.saves,
        }
      : {
          type: "playlist",
          item: {
            id: entry.id,
            title: entry.title,
            owner: entry.subtitle,
            coverUrl: entry.coverUrl ?? "",
            totalTracks: 0,
          },
          playCount: entry.saves,
        },
  );
}

export function usePopularAlbums() {
  return useCachedItems("popular-albums", loadPopularAlbums);
}

export function useMostSaved() {
  return useCachedItems("most-saved", loadMostSaved);
}
