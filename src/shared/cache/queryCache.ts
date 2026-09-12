interface CacheRecord<T> {
  data: T;
  timestamp: number;
  staleTimeMs: number;
  gcTimeMs: number;
}

class QueryCacheStore {
  private store = new Map<string, CacheRecord<any>>();
  private listeners = new Map<string, Set<(data: any) => void>>();
  private inFlight = new Map<string, Promise<any>>();

  public get<T>(key: string): T | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;
    if (Date.now() - record.timestamp > record.gcTimeMs) {
      this.store.delete(key);
      return undefined;
    }
    return record.data as T;
  }

  public isStale(key: string): boolean {
    const record = this.store.get(key);
    if (!record) return true;
    return Date.now() - record.timestamp > record.staleTimeMs;
  }

  public set<T>(
    key: string,
    data: T,
    staleTimeMs: number = 5 * 60 * 1000,
    gcTimeMs: number = 30 * 60 * 1000,
  ): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      staleTimeMs,
      gcTimeMs,
    });
    this.notify(key, data);
  }

  public delete(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  public getStats(): { count: number; bytes: number } {
    let bytes = 0;
    for (const [key, record] of this.store.entries()) {
      try {
        bytes += (key.length * 2) + (JSON.stringify(record?.data || {}).length * 2);
      } catch {
        bytes += key.length * 2 + 512;
      }
    }
    return { count: this.store.size, bytes };
  }

  public subscribe<T>(key: string, listener: (data: T) => void): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  private notify(key: string, data: any): void {
    const set = this.listeners.get(key);
    if (set) {
      for (const listener of set) {
        listener(data);
      }
    }
  }

  public async fetchWithSwr<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      staleTimeMs?: number;
      gcTimeMs?: number;
      force?: boolean;
    } = {},
  ): Promise<{ data: T; fromCache: boolean }> {
    const staleTimeMs = options.staleTimeMs ?? 5 * 60 * 1000;
    const gcTimeMs = options.gcTimeMs ?? 30 * 60 * 1000;
    const cached = this.get<T>(key);

    if (cached !== undefined && !options.force) {
      if (this.isStale(key)) {
        void this.revalidate(key, fetcher, staleTimeMs, gcTimeMs);
      }
      return { data: cached, fromCache: true };
    }

    let promise = this.inFlight.get(key);
    if (!promise) {
      promise = (async () => {
        try {
          const freshData = await fetcher();
          this.set(key, freshData, staleTimeMs, gcTimeMs);
          return freshData;
        } finally {
          this.inFlight.delete(key);
        }
      })();
      this.inFlight.set(key, promise);
    }

    const data = await promise;
    return { data, fromCache: false };
  }

  private async revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    staleTimeMs: number,
    gcTimeMs: number,
  ): Promise<void> {
    if (this.inFlight.has(key)) return;
    const promise = (async () => {
      try {
        const freshData = await fetcher();
        this.set(key, freshData, staleTimeMs, gcTimeMs);
      } catch {
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
  }
}

export const queryCache = new QueryCacheStore();
