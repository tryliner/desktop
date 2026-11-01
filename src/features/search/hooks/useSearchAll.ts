import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiSearchItem } from "@/shared/api";
import type { SearchSource } from "@/shared/contracts";

export interface UseSearchAllOptions {
  enabled: boolean;
  limit: number;
  debounceMs: number;
  source?: SearchSource;
}

export interface UseSearchAllResult {
  items: ApiSearchItem[];
  loading: boolean;
  hasLoaded: boolean;
  error: Error | null;
  partialWarning?: string;
  runNow: () => void;
}

export function useSearchAll(
  query: string,
  options: UseSearchAllOptions,
): UseSearchAllResult {
  const [items, setItems] = useState<ApiSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | undefined>();

  const source = options.source ?? "youtube";
  const latestRequestIdRef = useRef(0);
  const lastFetchedKeyRef = useRef("");
  const lastSourceRef = useRef(source);
  const abortControllerRef = useRef<AbortController | null>(null);
  const trimmed = query.trim();
  const shouldRunSearch = options.enabled && trimmed.length >= 2;

  const runRequest = useCallback(async (requestId: number, q: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await api.search(q, "all", source, signal);
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setItems(res.items);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = `${source}:${q}`;
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current || signal?.aborted) return;
      setItems([]);
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
      setItems([]);
      setError(null);
      setHasLoaded(false);
      lastFetchedKeyRef.current = "";
    }

    if (trimmed.length < 2) {
      latestRequestIdRef.current += 1;
      abortControllerRef.current?.abort();
      setItems([]);
      setHasLoaded(false);
      setLoading(false);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedKeyRef.current = "";
      return;
    }

    if (!options.enabled) return;

    const cacheKey = `${source}:${trimmed}`;
    if (lastFetchedKeyRef.current === cacheKey && items.length > 0) {
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
      if (lastFetchedKeyRef.current === cacheKey && items.length > 0) {
        setLoading(false);
        setHasLoaded(true);
        return;
      }
      void runRequest(requestId, trimmed, controller.signal);
    }, options.debounceMs ?? 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, options.enabled, options.debounceMs, runRequest, source, items.length]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    const requestId = ++latestRequestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    void runRequest(requestId, trimmed, controller.signal);
  }, [runRequest, shouldRunSearch, trimmed]);

  return { items, loading, hasLoaded, error, partialWarning, runNow };
}
