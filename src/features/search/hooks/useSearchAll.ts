import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiSearchItem, type CatalogSource, type SearchSource } from "@/shared/api";
import { isAbortError } from "@/shared/utils/abort";

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
  failedSources?: CatalogSource[];
  runNow: () => void;
}

export function useSearchAll(
  query: string,
  options: UseSearchAllOptions,
): UseSearchAllResult {
  const { source = "all" } = options;
  const [items, setItems] = useState<ApiSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [failedSources, setFailedSources] = useState<CatalogSource[] | undefined>();

  const latestRequestIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSearchKeyRef = useRef<string | null>(null);
  const completedSearchKeyRef = useRef<string | null>(null);
  const trimmed = query.trim();
  const searchKey = `${source}\u0000${trimmed}`;
  const shouldRunSearch = options.enabled && trimmed.length >= 2;

  const runRequest = useCallback(
    async (requestId: number, q: string, key: string, controller: AbortController) => {
      setLoading(true);
      try {
        const res = await api.search(q, "all", source, controller.signal);
        if (requestId !== latestRequestIdRef.current) return;
        setItems(res.items);
        setFailedSources(res.failedSources);
        setHasLoaded(true);
        completedSearchKeyRef.current = key;
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        if (requestId !== latestRequestIdRef.current) return;
        setItems([]);
        setFailedSources(undefined);
        setHasLoaded(true);
        completedSearchKeyRef.current = key;
      } finally {
        if (requestId === latestRequestIdRef.current) setLoading(false);
        if (activeControllerRef.current === controller) activeControllerRef.current = null;
      }
    },
    [source],
  );

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
      setItems([]);
      setHasLoaded(false);
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
    }, options.debounceMs ?? 320);
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
  }, [options.debounceMs, runRequest, searchKey, shouldRunSearch, trimmed]);

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
    setItems([]);
    setHasLoaded(false);
    setFailedSources(undefined);
    void runRequest(requestId, trimmed, searchKey, controller);
  }, [runRequest, searchKey, shouldRunSearch, trimmed]);

  return { items, loading, hasLoaded, failedSources, runNow };
}
