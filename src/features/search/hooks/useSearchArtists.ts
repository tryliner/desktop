import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiArtist } from "@/shared/api";
import type { SearchSource } from "@/shared/contracts";

export interface UseSearchArtistsOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
  source?: SearchSource;
}

export interface UseSearchArtistsResult {
  artists: ApiArtist[];
  loading: boolean;
  hasLoaded: boolean;
  error: Error | null;
  partialWarning?: string;
  runNow: () => void;
}

export function useSearchArtists(
  query: string,
  options: UseSearchArtistsOptions = {},
): UseSearchArtistsResult {
  const { enabled = true, debounceMs = 250, source = "youtube" } = options;
  const [artists, setArtists] = useState<ApiArtist[]>([]);
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
      const res = await api.search(q, "artist", source, signal);
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setArtists(
        res.items.filter((it): it is ApiArtist => it.type === "artist"),
      );
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = `${source}:${q}`;
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setArtists([]);
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
      setArtists([]);
      setHasLoaded(false);
      lastFetchedKeyRef.current = "";
    }

    if (trimmed.length < 2) {
      latestRequestIdRef.current += 1;
      abortControllerRef.current?.abort();
      setArtists([]);
      setHasLoaded(false);
      setLoading(false);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = "";
      return;
    }

    if (!enabled) return;

    const cacheKey = `${source}:${trimmed}`;
    if (lastFetchedKeyRef.current === cacheKey && artists.length > 0) {
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
      if (lastFetchedKeyRef.current === cacheKey && artists.length > 0) {
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
  }, [artists.length, debounceMs, enabled, runRequest, trimmed, source]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    const requestId = ++latestRequestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    void runRequest(requestId, trimmed, controller.signal);
  }, [runRequest, shouldRunSearch, trimmed]);

  return { artists, loading, hasLoaded, error, partialWarning, runNow };
}
