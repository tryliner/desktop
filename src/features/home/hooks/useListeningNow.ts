import { useEffect, useState } from "react";
import { api, toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";
import { shuffled } from "../lib/shuffled";

const LISTENING_NOW_LIMIT = 10;
const CACHE_TTL_MS = 60_000;

let cached: { tracks: Track[]; timestamp: number } | null = null;

export function useListeningNow() {
  const [tracks, setTracks] = useState<Track[]>(() => cached?.tracks ?? []);
  const [isLoading, setIsLoading] = useState(() => cached === null);

  useEffect(() => {
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return;

    let active = true;
    api
      .getPopularTracks("12h", LISTENING_NOW_LIMIT)
      .then((response) => {
        const next = shuffled(
          (response.items ?? []).map((entry) => toClientTrack(entry.track)),
        );
        cached = { tracks: next, timestamp: Date.now() };
        if (active) setTracks(next);
      })
      .catch(() => {
        if (active && !cached) setTracks([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { tracks: tracks.slice(0, LISTENING_NOW_LIMIT), isLoading };
}
