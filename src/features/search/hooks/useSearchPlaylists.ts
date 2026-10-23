import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiPlaylist, type CatalogSource, type SearchSource } from "@/shared/api";
import { isAbortError } from "@/shared/utils/abort";

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
  failedSources?: CatalogSource[];
  runNow: () => void;
}

export function useSearchPlaylists(
  query: string,
  options: UseSearchPlaylistsOptions = {},
): UseSearchPlaylistsResult {
  const { enabled = true, debounceMs = 250, source = "all" } = options;
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [failedSources, setFailedSources] = useState<CatalogSource[] | undefined>();

  const latestRequestIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSearchKeyRef = useRef<string | null>(null);
  const completedSearchKeyRef = useRef<string | null>(null);
  const trimmed = query.trim();
  const searchKey = `${source}\u0000${trimmed}`;
  const shouldRunSearch = enabled && trimmed.length >= 2;

  const runRequest = useCallback(async (requestId: number, q: string, key: string, controller: AbortController) => {
    setLoading(true);
    try {
      const res = await api.search(q, "playlist", source, controller.signal);
      if (requestId !== latestRequestIdRef.current) return;
      setPlaylists(
        res.items.filter((it) => it.type === "playlist"),
      );
      setError(null);
      setFailedSources(res.failedSources);
      setHasLoaded(true);
      completedSearchKeyRef.current = key;
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return;
      if (requestId !== latestRequestIdRef.current) return;
      setPlaylists([]);
      setError(err instanceof Error ? err : new Error(String(err)));
      setFailedSources(undefined);
      setHasLoaded(true);
      completedSearchKeyRef.current = key;
    } finally {
      if (requestId === latestRequestIdRef.current) setLoading(false);
      if (activeControllerRef.current === controller) activeControllerRef.current = null;
    }
  }, [source]);

  useEffect(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const requestId = ++latestRequestIdRef.current;
    const keyChanged = previousSearchKeyRef.current !== searchKey;
    previousSearchKeyRef.current = searchKey;
    if (keyChanged) {
      completedSearchKeyRef.current = null;
      setPlaylists([]);
      setHasLoaded(false);
      setError(null);
      setFailedSources(undefined);
    }
    if (!shouldRunSearch) {
      setLoading(false);
      return;
    }
    if (completedSearchKeyRef.current === searchKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      debounceTimerRef.current = null;
      const controller = new AbortController();
      activeControllerRef.current = controller;
      void runRequest(requestId, trimmed, searchKey, controller);
    }, debounceMs);
    debounceTimerRef.current = timer;

    return () => {
      if (debounceTimerRef.current === timer) {
        clearTimeout(timer);
        debounceTimerRef.current = null;
      }
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
      latestRequestIdRef.current += 1;
    };
  }, [debounceMs, runRequest, searchKey, shouldRunSearch, trimmed]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    activeControllerRef.current?.abort();
    completedSearchKeyRef.current = null;
    const requestId = ++latestRequestIdRef.current;
    const controller = new AbortController();
    activeControllerRef.current = controller;
    setPlaylists([]);
    setHasLoaded(false);
    setError(null);
    setFailedSources(undefined);
    void runRequest(requestId, trimmed, searchKey, controller);
  }, [runRequest, searchKey, shouldRunSearch, trimmed]);

  return { playlists, loading, hasLoaded, error, failedSources, runNow };
}
