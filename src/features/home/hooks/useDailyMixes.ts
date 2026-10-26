import { useEffect, useState } from "react";
import { api, toClientTrack, mediaUrl } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";
import type { Track } from "@/shared/types";
import type { CollectionPageData } from "@/features/collection/hooks/useCollection";
import { loadWithRetry, useSessionOwner } from "./sessionAwareLoad";

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
  targetCount: number = 4,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const addName = (raw?: string) => {
    if (!raw) return;
    const name = raw.trim();
    if (
      !name ||
      name.toLowerCase() === "unknown" ||
      seen.has(name.toLowerCase())
    ) {
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
        const parts = track.artists
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        for (const part of parts) {
          addName(part);
          if (result.length >= targetCount) return result;
        }
      }
    }
  }

  return result;
}

const cache = { data: [] as DailyMix[], timestamp: 0, owner: "" };
const CACHE_TTL = 120_000;

function cachedMixesFor(owner: string): DailyMix[] {
  return cache.owner === owner ? cache.data : [];
}

export function useDailyMixes() {
  const owner = useSessionOwner();
  const [data, setData] = useState<DailyMix[]>(() => cachedMixesFor(owner));
  const [isLoading, setIsLoading] = useState(() => cachedMixesFor(owner).length === 0);

  useEffect(() => {
    const cached = cachedMixesFor(owner);
    setData(cached);
    if (cached.length > 0 && Date.now() - cache.timestamp < CACHE_TTL) {
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(cached.length === 0);
    loadWithRetry(() => api.getDailyMixes(), () => active)
      .then((res) => {
        if (!active) return;
        const mixes: DailyMix[] = (res.items || []).map((mix) => {
          const clientTracks = (mix.tracks || []).map((t) => toClientTrack(t));
          const primaryCover = mix.cover?.url
            ? mediaUrl(mix.cover.url)
            : clientTracks[0]?.coverUrl || clientTracks[1]?.coverUrl;

          const computedArtists = getDailyMixArtists(
            mix.clusterArtists,
            clientTracks,
            4,
          );

          const mixItem: DailyMix = {
            id: mix.id,
            title: mix.title,
            description: mix.description,
            clusterArtists: computedArtists,
            coverUrl: primaryCover,
            trackCount: mix.trackCount || clientTracks.length,
            tracks: clientTracks,
          };
          const collectionData: CollectionPageData = {
            type: "playlist",
            title: mix.title,
            author:
              computedArtists.length > 0
                ? computedArtists.join(", ")
                : "Daily Mix",
            description: mix.description,
            coverUrl: primaryCover || "",
            tracks: clientTracks,
          };
          queryCache.set(`collection:playlist:${mix.id}`, collectionData);

          return mixItem;
        });

        cache.data = mixes;
        cache.timestamp = Date.now();
        cache.owner = owner;
        setData(mixes);
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
  }, [owner]);

  return { data, isLoading };
}
