import { useEffect, useState } from "react";
import { getAuthSession } from "@/shared/api";
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

const userCache = new Map<string, { data: DailyMix[]; timestamp: number }>();
const CACHE_TTL = 300_000;

export function useDailyMixes() {
  const [currentAccount, setCurrentAccount] = useState(
    () => getAuthSession()?.user?.id || "guest"
  );
  const cached = userCache.get(currentAccount);
  const [data, setData] = useState<DailyMix[]>(() => cached?.data ?? []);
  const [isLoading, setIsLoading] = useState(
    () => !cached || cached.data.length === 0
  );

  useEffect(() => {
    const onAuthChanged = () => {
      const nextAccount = getAuthSession()?.user?.id || "guest";
      setCurrentAccount(nextAccount);
      userCache.delete(nextAccount);
    };

    window.addEventListener("auth:changed", onAuthChanged);
    return () => {
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, []);

  useEffect(() => {
    const current = userCache.get(currentAccount);
    if (current && current.data.length > 0 && Date.now() - current.timestamp < CACHE_TTL) {
      setData(current.data);
      setIsLoading(false);
      return;
    }

    setData(current?.data ?? []);
    setIsLoading(true);

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
        userCache.set(currentAccount, { data: mixes, timestamp: Date.now() });
        setData(mixes);
      })
      .catch(() => {
        if (active) {
          const fallback = userCache.get(currentAccount)?.data ?? [];
          setData(fallback);
        }
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
  }, [currentAccount]);

  return { data, isLoading };
}
