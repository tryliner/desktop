import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiArtist } from "@/shared/api";

export interface UseSearchArtistsOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
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
  const { enabled = true, debounceMs = 250 } = options;
  const [artists, setArtists] = useState<ApiArtist[]>([]);
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
      const res = await api.search(q, "artist");
      if (requestId !== latestRequestIdRef.current) return;
      setArtists(
        res.items.filter((it): it is ApiArtist => it.type === "artist"),
      );
      setError(null);
      setPartialWarning(undefined);
      lastFetchedQueryRef.current = q;
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current) return;
      setArtists([]);
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
      setArtists([]);
      setHasLoaded(false);
      setLoading(false);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedQueryRef.current = "";
      return;
    }

    if (!enabled) return;

    if (lastFetchedQueryRef.current === trimmed && artists.length > 0) {
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    const requestId = ++latestRequestIdRef.current;
    const timer = setTimeout(() => {
      if (lastFetchedQueryRef.current === trimmed && artists.length > 0) {
        setLoading(false);
        setHasLoaded(true);
        return;
      }
      void runRequest(requestId, trimmed);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [artists.length, debounceMs, enabled, runRequest, trimmed]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    const requestId = ++latestRequestIdRef.current;
    void runRequest(requestId, trimmed);
  }, [runRequest, shouldRunSearch, trimmed]);

  return { artists, loading, hasLoaded, error, partialWarning, runNow };
}
