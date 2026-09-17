import { useEffect, useState } from "react";
import { api, toClientTrack, mediaUrl } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";
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

const cache = { data: [] as DailyMix[], timestamp: 0 };
const CACHE_TTL = 120_000;

export function useDailyMixes() {
  const [data, setData] = useState<DailyMix[]>(() => {
    return cache.data.length > 0 ? cache.data : [];
  });
  const [isLoading, setIsLoading] = useState(() => cache.data.length === 0);

  useEffect(() => {
    if (cache.data.length > 0 && Date.now() - cache.timestamp < CACHE_TTL) {
      setData(cache.data);
      setIsLoading(false);
      return;
    }

    let active = true;
    api
      .getDailyMixes()
      .then((res) => {
        if (!active) return;
        const mixes: DailyMix[] = (res.items || []).map((mix) => {
          const clientTracks = (mix.tracks || []).map((t) => toClientTrack(t));
          const primaryCover =
            mix.cover?.url ? mediaUrl(mix.cover.url) :
            (clientTracks[0]?.coverUrl ||
            clientTracks[1]?.coverUrl);

          const mixItem: DailyMix = {
            id: mix.id,
            title: mix.title,
            description: mix.description,
            clusterArtists: mix.clusterArtists || [],
            coverUrl: primaryCover,
            trackCount: mix.trackCount || clientTracks.length,
            tracks: clientTracks,
          };

          // Pre-cache collection playlist page so clicking opens instantly
          const collectionData: CollectionPageData = {
            type: "playlist",
            title: mix.title,
            author: mix.clusterArtists && mix.clusterArtists.length > 0 ? mix.clusterArtists.join(", ") : "Daily Mix",
            description: mix.description,
            coverUrl: primaryCover || "",
            tracks: clientTracks,
          };
          queryCache.set(`collection:playlist:${mix.id}`, collectionData);

          return mixItem;
        });

        cache.data = mixes;
        cache.timestamp = Date.now();
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
  }, []);

  return { data, isLoading };
}
