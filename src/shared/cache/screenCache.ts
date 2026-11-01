export interface ScreenCacheEntry<T = unknown> {
  data: T;
  savedAt: number;
  sessionOnly?: boolean;
}

const DB_NAME = "liner_screen_cache_v1";
const STORE = "entries";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const HYDRATE_TIMEOUT_MS = 250;
const FLUSH_DELAY_MS = 400;

const entries = new Map<string, ScreenCacheEntry>();
const listeners = new Map<string, Set<() => void>>();
const pendingWrites = new Map<string, ScreenCacheEntry | null>();
let dbPromise: Promise<IDBDatabase> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydration: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexeddb unavailable"));
  }
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function notify(key: string): void {
  listeners.get(key)?.forEach((listener) => listener());
}

function notifyAll(): void {
  for (const set of listeners.values()) set.forEach((listener) => listener());
}

async function readAll(): Promise<void> {
  const db = await openDb();
  const loaded = await new Promise<Array<[string, ScreenCacheEntry]>>(
    (resolve, reject) => {
      const rows: Array<[string, ScreenCacheEntry]> = [];
      const request = db
        .transaction(STORE, "readonly")
        .objectStore(STORE)
        .openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(rows);
          return;
        }
        rows.push([String(cursor.key), cursor.value as ScreenCacheEntry]);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    },
  );
  const now = Date.now();
  for (const [key, entry] of loaded) {
    if (
      !entry ||
      typeof entry.savedAt !== "number" ||
      now - entry.savedAt > MAX_AGE_MS
    ) {
      pendingWrites.set(key, null);
      continue;
    }
    if (entries.has(key)) continue;
    entries.set(key, entry);
    notify(key);
  }
  if (pendingWrites.size > 0) scheduleFlush();
}

export function hydrateScreenCache(): Promise<void> {
  hydration ??= Promise.race([
    readAll().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, HYDRATE_TIMEOUT_MS)),
  ]);
  return hydration;
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

async function flush(): Promise<void> {
  if (pendingWrites.size === 0) return;
  const batch = [...pendingWrites];
  pendingWrites.clear();
  try {
    const store = (await openDb())
      .transaction(STORE, "readwrite")
      .objectStore(STORE);
    for (const [key, entry] of batch) {
      try {
        if (entry) store.put(entry, key);
        else store.delete(key);
      } catch {}
    }
  } catch {}
}

export function readScreenCache<T>(
  key: string,
): ScreenCacheEntry<T> | undefined {
  return entries.get(key) as ScreenCacheEntry<T> | undefined;
}

export function writeScreenCache<T>(
  key: string,
  data: T,
  { persist = true }: { persist?: boolean } = {},
): ScreenCacheEntry<T> {
  const entry: ScreenCacheEntry<T> = persist
    ? { data, savedAt: Date.now() }
    : { data, savedAt: Date.now(), sessionOnly: true };
  entries.set(key, entry);
  pendingWrites.set(key, persist ? entry : null);
  scheduleFlush();
  notify(key);
  return entry;
}

export function touchScreenCache(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  entry.savedAt = Date.now();
  if (entry.sessionOnly) return;
  pendingWrites.set(key, entry);
  scheduleFlush();
}

export function subscribeScreenCache(
  key: string,
  listener: () => void,
): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

export function notifyScreenCache(key: string): void {
  notify(key);
}

export function clearScreenCache(): void {
  entries.clear();
  pendingWrites.clear();
  notifyAll();
  void openDb()
    .then((db) => {
      db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    })
    .catch(() => undefined);
}

export function clearPersistedScreenCache(): void {
  pendingWrites.clear();
  void openDb()
    .then((db) => {
      db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    })
    .catch(() => undefined);
}

export function getScreenCacheStats(): { count: number } {
  return { count: entries.size };
}
