import { useEffect, useState } from "react";
import { queryCache } from "@/shared/cache/queryCache";
import { generateYtDailyMixes } from "../services/ytDailyMixesService";
import type { Track } from "@/shared/types";
import type { CollectionPageData } from "@/features/collection/hooks/useCollection";

export interface DailyMix {
  id: string;
  title: string;
  description: string;
  clusterArtists: string[];
  coverUrl?: string;
  trackCount: number;
  tracks: Track[];
}

export function getDailyMixArtists(
  clusterArtists?: string[],
  tracks?: Track[],
  targetCount = 4
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const addName = (raw?: string) => {
    if (!raw) return;
    const name = raw.trim();
    if (!name || name.toLowerCase() === "unknown" || seen.has(name.toLowerCase())) {
      return;
    }
    seen.add(name.toLowerCase());
    result.push(name);
  };

  if (Array.isArray(clusterArtists)) {
    for (const name of clusterArtists) {
      addName(name);
      if (result.length >= targetCount) return result;
    }
  }

  if (Array.isArray(tracks)) {
    for (const track of tracks) {
      if (track.artistList && track.artistList.length > 0) {
        for (const a of track.artistList) {
          addName(a.name);
          if (result.length >= targetCount) return result;
        }
      } else if (track.artists) {
        const parts = track.artists.split(",").map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          addName(part);
          if (result.length >= targetCount) return result;
        }
      }
    }
  }

  return result;
}

const cache = { data: [] as DailyMix[], timestamp: 0 };
const CACHE_TTL = 300_000;

export function useDailyMixes() {
  const [data, setData] = useState<DailyMix[]>(() => cache.data);
  const [isLoading, setIsLoading] = useState(() => cache.data.length === 0);

  useEffect(() => {
    if (cache.data.length > 0 && Date.now() - cache.timestamp < CACHE_TTL) {
      setData(cache.data);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const timeoutId = setTimeout(() => {
      if (active) {
        controller.abort();
        setIsLoading(false);
      }
    }, 30_000);

    generateYtDailyMixes(controller.signal)
      .then((mixes) => {
        if (!active) return;
        for (const mix of mixes) {
          const collectionData: CollectionPageData = {
            type: "playlist",
            title: mix.title,
            author: mix.clusterArtists.length > 0 ? mix.clusterArtists.join(", ") : "Daily Mix",
            description: mix.description,
            coverUrl: mix.coverUrl || "",
            tracks: mix.tracks,
            isDailyMix: true,
          };
          queryCache.set(`collection:playlist:${mix.id}`, collectionData);
          queryCache.set(`collection:playlist:${encodeURIComponent(mix.id)}`, collectionData);
        }
        cache.data = mixes;
        cache.timestamp = Date.now();
        setData(mixes);
      })
      .catch(() => {
        if (active && cache.data.length === 0) setData([]);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return { data, isLoading };
}
