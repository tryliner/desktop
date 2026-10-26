import { useEffect, useState } from "react";
import { api, toClientTrack } from "@/shared/api";
import type { PopularItem } from "./usePopularTracks";
import { loadWithRetry, useSessionOwner } from "./sessionAwareLoad";

export const recentlyPlayedKeys = {
  all: ["recently_played"] as const,
};

const cache = new Map<string, { data: PopularItem[]; timestamp: number }>();
const CACHE_TTL = 60_000;

function cacheKey(owner: string, limit: number): string {
  return `recent_${owner}_${limit}`;
}

export function useRecentlyPlayed(limit = 20) {
  const owner = useSessionOwner();
  const [data, setData] = useState<PopularItem[]>(
    () => cache.get(cacheKey(owner, limit))?.data ?? [],
  );
  const [isLoading, setIsLoading] = useState(
    () => !cache.has(cacheKey(owner, limit)),
  );

  useEffect(() => {
    const key = cacheKey(owner, limit);
    const cached = cache.get(key);
    setData(cached?.data ?? []);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(!cached);
    const fetchLimit = Math.min(100, Math.max(limit * 3, 60));
    loadWithRetry(() => api.getHistory(undefined, fetchLimit), () => active)
      .then((res) => {
        if (!active) return;
        const seen = new Set<string>();
        const items: PopularItem[] = [];
        for (const entry of res.items || []) {
          if (!entry.track?.id) continue;

          const isAlbum = entry.context?.type === "album";
          const albumId = isAlbum ? (entry.context?.id || entry.track.album?.id) : undefined;

          if (albumId) {
            const albumKey = `album:${albumId}`;
            if (seen.has(albumKey)) continue;
            seen.add(albumKey);
            seen.add(`track:${entry.track.id}`);

            const clientTrack = toClientTrack(entry.track);
            items.push({
              type: "album",
              item: {
                id: albumId,
                title: entry.track.album?.title || clientTrack.title,
                artist: clientTrack.artists,
                coverUrl: clientTrack.coverUrl,
                totalTracks: 0,
                albumType: "album",
              },
              playCount: 1,
            });
          } else {
            const trackKey = `track:${entry.track.id}`;
            if (seen.has(trackKey)) continue;
            seen.add(trackKey);

            items.push({
              type: "track",
              item: toClientTrack(entry.track),
              playCount: 1,
            });
          }

          if (items.length >= limit) {
            break;
          }
        }
        cache.set(key, { data: items, timestamp: Date.now() });
        setData(items);
      })
      .catch(() => {
        if (active) setData([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [owner, limit]);

  return { data, isLoading };
}
