const MAX_CACHE_ENTRIES = 500;

export function trimCache(
  cache: Record<string, string[]>,
  max = MAX_CACHE_ENTRIES,
): Record<string, string[]> {
  const keys = Object.keys(cache);
  if (keys.length <= max) return cache;
  const pruned: Record<string, string[]> = {};
  for (const k of keys.slice(keys.length - max)) {
    pruned[k] = cache[k];
  }
  return pruned;
}

export function getTranslationCacheKey(
  trackId: string,
  targetLang: string,
  singableMode = false,
  provider?: string | null,
): string {
  const base = singableMode
    ? `${trackId}:${targetLang}:singable`
    : `${trackId}:${targetLang}`;
  return provider ? `${base}:${provider}` : base;
}

export function getRomanizationCacheKey(
  trackId: string,
  provider?: string | null,
): string {
  return provider ? `${trackId}:${provider}` : trackId;
}

export function sanitizeAiTranslateForExport(
  persistedString: string,
): string {
  try {
    const data = JSON.parse(persistedString);
    if (data && typeof data === "object" && "state" in data) {
      if (data.state && typeof data.state === "object") {
        data.state.apiKey = "";
      }
    } else if (data && typeof data === "object" && "apiKey" in data) {
      data.apiKey = "";
    }
    return JSON.stringify(data);
  } catch {
    return persistedString;
  }
}
