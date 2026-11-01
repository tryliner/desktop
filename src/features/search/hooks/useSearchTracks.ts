import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiTrack } from "@/shared/api";
import { toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";
import type { SearchSource } from "@/shared/contracts";

export interface UseSearchTracksOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
  source?: SearchSource;
}

export interface UseSearchTracksResult {
  tracks: Track[];
  loading: boolean;
  hasLoaded: boolean;
  error: Error | null;
  partialWarning?: string;
  runNow: () => void;
}

export function useSearchTracks(
  query: string,
  options: UseSearchTracksOptions = {},
): UseSearchTracksResult {
  const { enabled = true, debounceMs = 250, source = "youtube" } = options;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | undefined>();

  const latestRequestIdRef = useRef(0);
  const lastFetchedKeyRef = useRef("");
  const lastSourceRef = useRef(source);
  const abortControllerRef = useRef<AbortController | null>(null);
  const trimmed = query.trim();
  const shouldRunSearch = enabled && trimmed.length >= 2;

  const runRequest = useCallback(async (requestId: number, q: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await api.search(q, "track", source, signal);
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setTracks(
        res.items
          .filter(
            (it): it is ApiTrack & { type: "track" } => it.type === "track",
          )
          .map(toClientTrack),
      );
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = `${source}:${q}`;
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setTracks([]);
      setError(err instanceof Error ? err : new Error(String(err)));
      setPartialWarning(undefined);
      setHasLoaded(true);
    } finally {
      if (requestId === latestRequestIdRef.current) setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    if (lastSourceRef.current !== source) {
      lastSourceRef.current = source;
      latestRequestIdRef.current += 1;
      abortControllerRef.current?.abort();
      setTracks([]);
      setHasLoaded(false);
      lastFetchedKeyRef.current = "";
    }

    if (trimmed.length < 2) {
      latestRequestIdRef.current += 1;
      abortControllerRef.current?.abort();
      setTracks([]);
      setHasLoaded(false);
      setLoading(false);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = "";
      return;
    }

    if (!enabled) return;

    const cacheKey = `${source}:${trimmed}`;
    if (lastFetchedKeyRef.current === cacheKey && tracks.length > 0) {
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    const requestId = ++latestRequestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(() => {
      if (lastFetchedKeyRef.current === cacheKey && tracks.length > 0) {
        setLoading(false);
        setHasLoaded(true);
        return;
      }
      void runRequest(requestId, trimmed, controller.signal);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [debounceMs, enabled, runRequest, tracks.length, trimmed, source]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    const requestId = ++latestRequestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    void runRequest(requestId, trimmed, controller.signal);
  }, [runRequest, shouldRunSearch, trimmed]);

  return { tracks, loading, hasLoaded, error, partialWarning, runNow };
}
