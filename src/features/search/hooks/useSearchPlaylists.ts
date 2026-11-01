import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiPlaylist } from "@/shared/api";
import type { SearchSource } from "@/shared/contracts";

export interface UseSearchPlaylistsOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
  source?: SearchSource;
}

export interface UseSearchPlaylistsResult {
  playlists: ApiPlaylist[];
  loading: boolean;
  hasLoaded: boolean;
  error: Error | null;
  partialWarning?: string;
  runNow: () => void;
}

export function useSearchPlaylists(
  query: string,
  options: UseSearchPlaylistsOptions = {},
): UseSearchPlaylistsResult {
  const { enabled = true, debounceMs = 250, source = "youtube" } = options;
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
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
      const res = await api.search(q, "playlist", source, signal);
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setPlaylists(
        res.items.filter((it): it is ApiPlaylist => it.type === "playlist"),
      );
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = `${source}:${q}`;
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setPlaylists([]);
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
      setPlaylists([]);
      setHasLoaded(false);
      lastFetchedKeyRef.current = "";
    }

    if (trimmed.length < 2) {
      latestRequestIdRef.current += 1;
      abortControllerRef.current?.abort();
      setPlaylists([]);
      setHasLoaded(false);
      setLoading(false);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = "";
      return;
    }

    if (!enabled) return;

    const cacheKey = `${source}:${trimmed}`;
    if (lastFetchedKeyRef.current === cacheKey && playlists.length > 0) {
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
      if (lastFetchedKeyRef.current === cacheKey && playlists.length > 0) {
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
  }, [debounceMs, enabled, playlists.length, runRequest, trimmed, source]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    const requestId = ++latestRequestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    void runRequest(requestId, trimmed, controller.signal);
  }, [runRequest, shouldRunSearch, trimmed]);

  return { playlists, loading, hasLoaded, error, partialWarning, runNow };
}
