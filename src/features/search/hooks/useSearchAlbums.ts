import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiAlbum } from "@/shared/api";

export interface UseSearchAlbumsOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
}

export interface UseSearchAlbumsResult {
  albums: ApiAlbum[];
  loading: boolean;
  hasLoaded: boolean;
  error: Error | null;
  partialWarning?: string;
  runNow: () => void;
}

export function useSearchAlbums(
  query: string,
  options: UseSearchAlbumsOptions = {},
): UseSearchAlbumsResult {
  const { enabled = true, debounceMs = 250 } = options;
  const [albums, setAlbums] = useState<ApiAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | undefined>();

  const latestRequestIdRef = useRef(0);
  const lastFetchedQueryRef = useRef("");
  const trimmed = query.trim();
  const shouldRunSearch = enabled && trimmed.length >= 2;

  const runRequest = useCallback(async (requestId: number, q: string) => {
    setLoading(true);
    try {
      const res = await api.search(q, "album");
      if (requestId !== latestRequestIdRef.current) return;
      setAlbums(
        res.items.filter((it): it is ApiAlbum => it.type === "album"),
      );
      setError(null);
      setPartialWarning(undefined);
      lastFetchedQueryRef.current = q;
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current) return;
      setAlbums([]);
      setError(err instanceof Error ? err : new Error(String(err)));
      setPartialWarning(undefined);
      setHasLoaded(true);
    } finally {
      if (requestId === latestRequestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (trimmed.length < 2) {
      latestRequestIdRef.current += 1;
      setAlbums([]);
      setHasLoaded(false);
      setLoading(false);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedQueryRef.current = "";
      return;
    }

    if (!enabled) return;

    if (lastFetchedQueryRef.current === trimmed && albums.length > 0) {
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    const requestId = ++latestRequestIdRef.current;
    const timer = setTimeout(() => {
      if (lastFetchedQueryRef.current === trimmed && albums.length > 0) {
        setLoading(false);
        setHasLoaded(true);
        return;
      }
      void runRequest(requestId, trimmed);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [albums.length, debounceMs, enabled, runRequest, trimmed]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    const requestId = ++latestRequestIdRef.current;
    void runRequest(requestId, trimmed);
  }, [runRequest, shouldRunSearch, trimmed]);

  return { albums, loading, hasLoaded, error, partialWarning, runNow };
}
