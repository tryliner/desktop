import { linerDb } from "@/shared/storage/linerDb";
import {
  audioCache,
  DEFAULT_AUDIO_CACHE_LIMIT_BYTES,
  MIN_AUDIO_CACHE_LIMIT_BYTES,
} from "@/shared/storage/audioCache";
import { queryCache } from "@/shared/cache/queryCache";
import { lyricsCache } from "@/features/lyrics";

export { DEFAULT_AUDIO_CACHE_LIMIT_BYTES, MIN_AUDIO_CACHE_LIMIT_BYTES };

export function getAudioCacheLimitBytes(): number {
  return audioCache.getLimitBytes();
}

export async function setAudioCacheLimitBytes(bytes: number): Promise<void> {
  await audioCache.setLimitBytes(bytes);
}

const PRESERVED_STORAGE_KEYS = new Set([
  "liner_access_token",
  "liner_refresh_token",
  "liner_auth_session",
  "liner_locale",
  "theme",
]);

export type StorageCategoryId = "covers" | "audio" | "lyrics" | "metadata";

export interface StorageCategoryItem {
  id: StorageCategoryId;
  labelKey: string;
  bytes: number;
  count?: number;
  color: string;
}

export interface StorageAnalytics {
  categories: StorageCategoryItem[];
  totalBytes: number;
  audioCacheLimitBytes?: number;
  deviceQuotaBytes?: number;
  deviceUsageBytes?: number;
  deviceUsagePercent?: number;
  cachePath?: string;
}

/**
 * Clears cached network responses and cover image caches stored in CacheStorage and localStorage.
 */
export async function clearMediaAndCoverCache(): Promise<void> {
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    } catch {
      // Best-effort cache cleanup
    }
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("liner:playlist-covers") ||
          key.startsWith("liner:cover:") ||
          key.startsWith("liner:cache:"))
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Clears search query caches and cached catalog lookups.
 */
export async function clearSearchAndQueryCache(): Promise<void> {
  if (typeof window !== "undefined" && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("liner:search:") ||
          key.startsWith("liner:query:") ||
          key.startsWith("search-cache"))
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Clears temporary application cache while preserving auth and user settings.
 */
export async function clearApplicationCacheSafely(): Promise<void> {
  await Promise.all([
    clearMediaAndCoverCache(),
    clearSearchAndQueryCache(),
  ]);

  if (typeof window !== "undefined" && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !PRESERVED_STORAGE_KEYS.has(key)) {
        if (
          key.startsWith("liner:") ||
          key.startsWith("lyrics-storage") ||
          key === "player-temp"
        ) {
          keysToRemove.push(key);
        }
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}

// calculates approximate byte size of cover cache in serviceworker
async function getCoverCacheBytes(): Promise<{ bytes: number; count: number }> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return { bytes: 0, count: 0 };
  }
  try {
    const hasCovers = await window.caches.has("liner-covers-v2");
    if (!hasCovers) return { bytes: 0, count: 0 };
    const cache = await window.caches.open("liner-covers-v2");
    const requests = await cache.keys();
    const count = requests.length;
    if (count === 0) return { bytes: 0, count: 0 };

    // sample up to 20 entries to avoid main thread jank with large catalogs
    const sampleLimit = Math.min(count, 20);
    let sampleBytes = 0;
    for (let i = 0; i < sampleLimit; i++) {
      const resp = await cache.match(requests[i]);
      if (resp) {
        const cl = resp.headers.get("content-length");
        if (cl) {
          sampleBytes += parseInt(cl, 10) || 0;
        } else {
          const blob = await resp.clone().blob();
          sampleBytes += blob.size;
        }
      }
    }
    const avg = sampleLimit > 0 ? sampleBytes / sampleLimit : 0;
    const estimated = Math.round(avg * count);
    return { bytes: estimated, count };
  } catch {
    return { bytes: 0, count: 0 };
  }
}

// gathers live analytics across indexeddb, caches, localstorage and electron
export async function getStorageAnalytics(): Promise<StorageAnalytics> {
  let audioBytes = 0;
  let coversBytes = 0;
  let coversCount = 0;
  let lyricsBytes = 0;
  let metadataBytes = 0;
  let cachePath = "";

  // 1. electron disk measurements (if running inside electron app)
  let electronStats: {
    cacheSize: number;
    httpCacheSize: number;
    codeCacheSize: number;
    serviceWorkerSize: number;
    indexedDbSize: number;
    localStorageSize: number;
    blobStorageSize: number;
    cachePath: string;
  } | null = null;

  if (typeof window !== "undefined" && window.linerElectron?.getCacheStats) {
    try {
      electronStats = await window.linerElectron.getCacheStats();
      if (electronStats.cachePath) {
        cachePath = electronStats.cachePath;
      }
    } catch {}
  }

  // 2. indexeddb audio tracks & metadata added in linerDb
  try {
    const audioTrackBytes = await linerDb.getTotalTrackBytes();
    const audioBlobBytes = await linerDb.getTotalAudioBytes();
    audioBytes = audioTrackBytes + audioBlobBytes;
  } catch {}

  // take the maximum between indexeddb object store iteration and physical disk size
  if (electronStats && electronStats.indexedDbSize > 0) {
    const totalIdbDisk = electronStats.indexedDbSize + (electronStats.blobStorageSize || 0);
    audioBytes = Math.max(audioBytes, totalIdbDisk);
  }

  // 3. serviceworker covers added in cover-sw.js
  try {
    const coverStats = await getCoverCacheBytes();
    coversBytes = coverStats.bytes;
    coversCount = coverStats.count;
  } catch {}

  // physical disk size for service worker cache storage
  if (electronStats && electronStats.serviceWorkerSize > 0) {
    coversBytes = Math.max(coversBytes, electronStats.serviceWorkerSize);
  }

  // 4. lyrics cache added in lyricsCache.ts + linerDb lyrics
  try {
    const lBytes = await linerDb.getTotalLyricsBytes();
    const lStats = lyricsCache.getStats();
    lyricsBytes = lBytes + lStats.bytes;
  } catch {}

  // 5. in-memory catalog cache added in queryCache.ts + linerDb artists
  try {
    const qStats = queryCache.getStats();
    const aBytes = await linerDb.getTotalArtistBytes();
    metadataBytes += qStats.bytes + aBytes;
  } catch {}

  // 6. localstorage inspection for covers, search and metadata
  if (typeof window !== "undefined" && window.localStorage) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) || "";
      const size = (k.length + v.length) * 2;
      if (k.startsWith("liner:playlist-covers") || k.startsWith("liner:cover:")) {
        coversBytes += size;
      } else if (k.startsWith("liner:search:") || k.startsWith("liner:query:") || k.startsWith("search-cache")) {
        metadataBytes += size;
      } else if (k.startsWith("liner:artist:")) {
        metadataBytes += size;
      } else if (
        k.startsWith("liner_lyrics_") ||
        k.startsWith("lyrics-storage")
      ) {
        if (!k.startsWith("liner_lyrics_item_") && k !== "liner_lyrics_lru_index") {
          lyricsBytes += size;
        }
      }
    }
  }

  // 7. device quota estimate
  let deviceQuotaBytes: number | undefined;
  let deviceUsageBytes: number | undefined;
  let deviceUsagePercent: number | undefined;

  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      deviceQuotaBytes = estimate.quota;
      deviceUsageBytes = estimate.usage;
      if (estimate.quota && estimate.quota > 0 && estimate.usage !== undefined) {
        deviceUsagePercent = Math.min(100, Math.max(0.01, (estimate.usage / estimate.quota) * 100));
      }
    } catch {}
  }

  const categories: StorageCategoryItem[] = [
    {
      id: "covers",
      labelKey: "settings.storage.categories.covers",
      bytes: coversBytes,
      count: coversCount,
      color: "#06B6D4", // cyan
    },
    {
      id: "audio",
      labelKey: "settings.storage.categories.audio",
      bytes: audioBytes,
      color: "#8B5CF6", // purple
    },
    {
      id: "lyrics",
      labelKey: "settings.storage.categories.lyrics",
      bytes: lyricsBytes,
      color: "#EC4899", // pink
    },
    {
      id: "metadata",
      labelKey: "settings.storage.categories.metadata",
      bytes: metadataBytes,
      color: "#F59E0B", // amber
    },
  ];

  const totalBytes = categories.reduce((sum, c) => sum + c.bytes, 0);

  return {
    categories,
    totalBytes,
    audioCacheLimitBytes: audioCache.getLimitBytes(),
    deviceQuotaBytes,
    deviceUsageBytes,
    deviceUsagePercent,
    cachePath,
  };
}

// clears chosen categories cleanly while maintaining user session
export async function clearStorageCategories(categoryIds: StorageCategoryId[]): Promise<void> {
  const set = new Set(categoryIds);

  if (set.has("audio")) {
    audioCache.revokeAll();
    await linerDb.clearStore("audio");
    await linerDb.clearStore("tracks");
    if (typeof window !== "undefined" && window.linerElectron?.clearAudioCache) {
      await window.linerElectron.clearAudioCache();
    }
  }

  if (set.has("covers")) {
    await clearMediaAndCoverCache();
    if (typeof window !== "undefined" && window.linerElectron?.clearCoversCache) {
      await window.linerElectron.clearCoversCache();
    }
  }

  if (set.has("lyrics")) {
    lyricsCache.clear();
    await linerDb.clearStore("lyrics");
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem("lyrics-storage");
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("liner_lyrics_")) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
  }

  if (set.has("metadata")) {
    queryCache.clear();
    await linerDb.clearStore("artists");
    await clearSearchAndQueryCache();
    if (typeof window !== "undefined" && window.localStorage) {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("liner:artist:")) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
  }
}

export async function openCacheFolder(): Promise<boolean> {
  if (typeof window !== "undefined" && window.linerElectron?.openCacheFolder) {
    return window.linerElectron.openCacheFolder();
  }
  return false;
}

// formats raw bytes into clean human readable format
export function formatStorageBytes(bytes: number): string {
  if (bytes <= 0 || !Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

const CACHE_ANALYTICS_STORAGE_KEY = "liner_cached_storage_analytics";

function readPersistedAnalytics(): StorageAnalytics | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_ANALYTICS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StorageAnalytics) : null;
  } catch {
    return null;
  }
}

function writePersistedAnalytics(data: StorageAnalytics): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(CACHE_ANALYTICS_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

let cachedStorageAnalytics: StorageAnalytics | null = readPersistedAnalytics();
let isStorageTabOpen = false;
let backgroundIntervalId: ReturnType<typeof setInterval> | null = null;
let isBackgroundUpdating = false;

// returns cached analytics synchronously if available
export function getCachedStorageAnalytics(): StorageAnalytics | null {
  return cachedStorageAnalytics;
}

// notifies background scheduler whether storage tab is open (pauses polling to prevent UI flicker)
export function setStorageTabOpen(isOpen: boolean): void {
  isStorageTabOpen = isOpen;
}

// performs background update of storage analytics
export async function refreshStorageAnalytics(): Promise<StorageAnalytics> {
  if (isBackgroundUpdating && cachedStorageAnalytics) {
    return cachedStorageAnalytics;
  }
  isBackgroundUpdating = true;
  try {
    const data = await getStorageAnalytics();
    cachedStorageAnalytics = data;
    writePersistedAnalytics(data);
    return data;
  } finally {
    isBackgroundUpdating = false;
  }
}

// initializes background polling (every 60s when storage tab is closed)
export function initBackgroundStorageAnalytics(): void {
  if (typeof window === "undefined") return;

  // non-blocking initial fetch 1.5s after launch
  setTimeout(() => {
    void refreshStorageAnalytics();
  }, 1500);

  // periodic background interval (60 seconds)
  if (!backgroundIntervalId) {
    backgroundIntervalId = setInterval(() => {
      // skip update if user currently has storage tab open so nothing blinks or jumps
      if (isStorageTabOpen) return;
      void refreshStorageAnalytics();
    }, 60_000);
  }
}

// automatically start in browser/electron
if (typeof window !== "undefined") {
  initBackgroundStorageAnalytics();
}


