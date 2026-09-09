/**
 * Safe application cache management utility.
 *
 * NEVER clears essential user data such as authentication session tokens,
 * theme, or locale preferences.
 */

const PRESERVED_STORAGE_KEYS = new Set([
  "liner_access_token",
  "liner_refresh_token",
  "liner_auth_session",
  "liner_locale",
  "theme",
]);

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
