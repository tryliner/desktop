import { useEffect, useState } from "react";
import { api, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";

export type PopularTrackItem = Track;

export interface PopularAlbumItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  totalTracks: number;
  albumType: string;
  explicit?: boolean;
}

export interface PopularPlaylistItem {
  id: string;
  title: string;
  owner: string;
  coverUrl: string;
  totalTracks: number;
}

export type PopularItem =
  | { type: "track"; item: PopularTrackItem; playCount: number }
  | { type: "album"; item: PopularAlbumItem; playCount: number }
  | { type: "playlist"; item: PopularPlaylistItem; playCount: number };

export const popularTracksKeys = {
  all: ["popular"] as const,
  onlyTracks: ["popularTracks"] as const,
};

export const popularTracksAllTimeKeys = {
  allTime: ["popularTracksAllTime"] as const,
};

const cache = new Map<string, { data: PopularItem[]; timestamp: number }>();
const CACHE_TTL = 60_000;

export function usePopularTracksOnly(limit = 20) {
  const [data, setData] = useState<PopularItem[]>(() => cache.get(`tracks_7d_${limit}`)?.data ?? []);
  const [isLoading, setIsLoading] = useState(!cache.has(`tracks_7d_${limit}`));

  useEffect(() => {
    const cached = cache.get(`tracks_7d_${limit}`);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setIsLoading(false);
      return;
    }

    let active = true;
    api
      .getPopularTracks("7d", limit)
      .then((res) => {
        if (!active) return;
        const items: PopularItem[] = (res.items || []).map((entry) => ({
          type: "track",
          item: toClientTrack(entry.track),
          playCount: entry.playCount,
        }));
        cache.set(`tracks_7d_${limit}`, { data: items, timestamp: Date.now() });
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
  }, [limit]);

  return { data, isLoading };
}

export function usePopularTracksAllTime(limit = 20) {
  const [data, setData] = useState<PopularItem[]>(() => cache.get(`tracks_all_${limit}`)?.data ?? []);
  const [isLoading, setIsLoading] = useState(!cache.has(`tracks_all_${limit}`));

  useEffect(() => {
    const cached = cache.get(`tracks_all_${limit}`);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setIsLoading(false);
      return;
    }

    let active = true;
    api
      .getPopularTracks("all", limit)
      .then((res) => {
        if (!active) return;
        const items: PopularItem[] = (res.items || []).map((entry) => ({
          type: "track",
          item: toClientTrack(entry.track),
          playCount: entry.playCount,
        }));
        cache.set(`tracks_all_${limit}`, { data: items, timestamp: Date.now() });
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
  }, [limit]);

  return { data, isLoading };
}
