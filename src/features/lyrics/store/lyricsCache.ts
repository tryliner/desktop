import type {
  LyricsCandidate,
  LyricsSyncLevel,
} from "@/shared/contracts/lyrics";
import type { LyricsProviderOption } from "./lyricsStore";

export interface CachedLyricsItem {
  trackId: string;
  candidate: LyricsCandidate;
  providers?: Record<string, LyricsCandidate>;
  availableProviders?: LyricsProviderOption[];
  timestamp: number;
}

const STORAGE_INDEX_KEY = "liner_lyrics_v2_index";
const STORAGE_PREFIX = "liner_lyrics_v2_item_";
const MAX_ENTRIES = 250;

const SYNC_RANK: Record<LyricsSyncLevel, number> = {
  plain: 0,
  line_level: 1,
  syllable_level: 2,
  word_level: 3,
};

// word-level or syllable-level sync check
export function isWordLevelSync(syncLevel: LyricsSyncLevel): boolean {
  return syncLevel === "word_level" || syncLevel === "syllable_level";
}

// strict word-level check for ai/timing providers
export function shouldCacheLyricsCandidate(
  candidate?: LyricsCandidate | null,
): boolean {
  if (!candidate || !candidate.lyrics?.content) return false;
  const p = (candidate.provider || "")
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, " ");

  // cadence, polaris, polaris mono: only cache if word-level returned
  if (p === "cadence" || p === "polaris" || p === "polaris mono") {
    return isWordLevelSync(candidate.syncLevel);
  }

  return true;
}

// ranks lyrics candidates by priority, sync depth, and quality
export function compareLyricsCandidates(
  a: LyricsCandidate,
  b: LyricsCandidate,
): number {
  if (a.topPriority !== b.topPriority) return a.topPriority ? -1 : 1;
  const rankA = SYNC_RANK[a.syncLevel] ?? 0;
  const rankB = SYNC_RANK[b.syncLevel] ?? 0;
  if (rankA !== rankB) return rankB - rankA;
  if (b.quality.total !== a.quality.total) {
    return b.quality.total - a.quality.total;
  }

  const isWordA = isWordLevelSync(a.syncLevel);
  const isWordB = isWordLevelSync(b.syncLevel);
  if (isWordA && isWordB) {
    const provA = (a.provider || "").toLowerCase().trim().replace(/[-_]/g, " ");
    const provB = (b.provider || "").toLowerCase().trim().replace(/[-_]/g, " ");
    if (provA === "polaris mono" || provA === "binimum") return -1;
    if (provB === "polaris mono" || provB === "binimum") return 1;
  }
  return 0;
}

export function isBetterLyricsCandidate(
  next: LyricsCandidate,
  current: LyricsCandidate,
): boolean {
  return compareLyricsCandidates(next, current) < 0;
}

function normalizeProviderKey(provider: string): string {
  return provider.toLowerCase().trim();
}

class LyricsCache {
  private memCache = new Map<string, CachedLyricsItem>();

  constructor() {
    this.hydrateIndex();
  }

  private hydrateIndex() {
    try {
      if (typeof localStorage === "undefined") return;

      // purge legacy v1 cache keys on startup
      const legacyIndexRaw = localStorage.getItem("liner_lyrics_lru_index");
      if (legacyIndexRaw) {
        try {
          const legacyIndex: string[] = JSON.parse(legacyIndexRaw);
          if (Array.isArray(legacyIndex)) {
            for (const id of legacyIndex) {
              localStorage.removeItem("liner_lyrics_item_" + id);
            }
          }
        } catch {}
        localStorage.removeItem("liner_lyrics_lru_index");
      }

      const raw = localStorage.getItem(STORAGE_INDEX_KEY);
      if (!raw) return;
      const index: string[] = JSON.parse(raw);
      if (Array.isArray(index)) {
        for (const trackId of index.slice(-30)) {
          this.loadFromStorage(trackId);
        }
      }
    } catch {}
  }

  private getIndex(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveIndex(index: string[]) {
    try {
      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
    } catch {}
  }

  private normalizeItem(parsed: CachedLyricsItem): CachedLyricsItem | null {
    if (!parsed || !parsed.trackId) return null;

    // hydrate provider map if missing from older storage schemas
    const providers: Record<string, LyricsCandidate> = {
      ...(parsed.providers || {}),
    };
    if (parsed.candidate && shouldCacheLyricsCandidate(parsed.candidate)) {
      const key = normalizeProviderKey(parsed.candidate.provider);
      if (!providers[key]) providers[key] = parsed.candidate;
    }
    if (parsed.availableProviders) {
      for (const opt of parsed.availableProviders) {
        if (opt.candidate && shouldCacheLyricsCandidate(opt.candidate)) {
          const key = normalizeProviderKey(opt.provider);
          if (!providers[key]) providers[key] = opt.candidate;
        }
      }
    }

    const validCandidates = Object.values(providers).filter(
      shouldCacheLyricsCandidate,
    );
    if (validCandidates.length === 0) return null;

    const availableProviders: LyricsProviderOption[] = validCandidates
      .map((c) => ({
        provider: c.provider,
        syncLevel: c.syncLevel,
        quality: c.quality.total,
        candidate: c,
      }))
      .sort((a, b) => compareLyricsCandidates(a.candidate, b.candidate));

    const candidate =
      parsed.candidate && shouldCacheLyricsCandidate(parsed.candidate)
        ? parsed.candidate
        : availableProviders[0].candidate;

    return {
      trackId: parsed.trackId,
      candidate,
      providers,
      availableProviders,
      timestamp: parsed.timestamp || Date.now(),
    };
  }

  private loadFromStorage(trackId: string): CachedLyricsItem | null {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + trackId);
      if (!raw) return null;
      const parsed: CachedLyricsItem = JSON.parse(raw);
      const normalized = this.normalizeItem(parsed);
      if (normalized) {
        this.memCache.set(trackId, normalized);
        return normalized;
      }
      return null;
    } catch {
      return null;
    }
  }

  get(trackId: string): CachedLyricsItem | null {
    let item: CachedLyricsItem | null = null;
    if (this.memCache.has(trackId)) {
      item = this.memCache.get(trackId)!;
    } else {
      item = this.loadFromStorage(trackId);
    }
    if (!item) return null;
    this.touch(trackId);
    return item;
  }

  getProvider(trackId: string, provider: string): LyricsCandidate | null {
    const item = this.get(trackId);
    if (!item?.providers) return null;
    return item.providers[normalizeProviderKey(provider)] || null;
  }

  has(trackId: string, provider?: string): boolean {
    if (provider) {
      return Boolean(this.getProvider(trackId, provider));
    }
    return Boolean(this.get(trackId));
  }

  setProvider(trackId: string, candidate: LyricsCandidate) {
    if (!shouldCacheLyricsCandidate(candidate)) return;

    const existing = this.get(trackId);
    const providers: Record<string, LyricsCandidate> = {
      ...(existing?.providers || {}),
    };
    providers[normalizeProviderKey(candidate.provider)] = candidate;

    const validCandidates = Object.values(providers).filter(
      shouldCacheLyricsCandidate,
    );
    const availableProviders: LyricsProviderOption[] = validCandidates
      .map((c) => ({
        provider: c.provider,
        syncLevel: c.syncLevel,
        quality: c.quality.total,
        candidate: c,
      }))
      .sort((a, b) => compareLyricsCandidates(a.candidate, b.candidate));

    const bestCandidate =
      existing?.candidate && shouldCacheLyricsCandidate(existing.candidate)
        ? isBetterLyricsCandidate(candidate, existing.candidate)
          ? candidate
          : existing.candidate
        : availableProviders[0]?.candidate || candidate;

    const item: CachedLyricsItem = {
      trackId,
      candidate: bestCandidate,
      providers,
      availableProviders,
      timestamp: Date.now(),
    };

    this.memCache.set(trackId, item);
    this.saveToStorage(item);
    this.touch(trackId);
  }

  set(
    trackId: string,
    candidate: LyricsCandidate,
    availableProviders?: LyricsProviderOption[],
  ) {
    const existing = this.get(trackId);
    const providers: Record<string, LyricsCandidate> = {
      ...(existing?.providers || {}),
    };

    if (shouldCacheLyricsCandidate(candidate)) {
      providers[normalizeProviderKey(candidate.provider)] = candidate;
    }

    if (availableProviders) {
      for (const opt of availableProviders) {
        if (opt.candidate && shouldCacheLyricsCandidate(opt.candidate)) {
          providers[normalizeProviderKey(opt.candidate.provider)] =
            opt.candidate;
        }
      }
    }

    const validCandidates = Object.values(providers).filter(
      shouldCacheLyricsCandidate,
    );
    if (validCandidates.length === 0) return;

    const validOptions: LyricsProviderOption[] = validCandidates
      .map((c) => ({
        provider: c.provider,
        syncLevel: c.syncLevel,
        quality: c.quality.total,
        candidate: c,
      }))
      .sort((a, b) => compareLyricsCandidates(a.candidate, b.candidate));

    const bestCandidate =
      shouldCacheLyricsCandidate(candidate)
        ? candidate
        : validOptions[0].candidate;

    const item: CachedLyricsItem = {
      trackId,
      candidate: bestCandidate,
      providers,
      availableProviders: validOptions,
      timestamp: Date.now(),
    };

    this.memCache.set(trackId, item);
    this.saveToStorage(item);
    this.touch(trackId);
  }

  private saveToStorage(item: CachedLyricsItem) {
    try {
      localStorage.setItem(STORAGE_PREFIX + item.trackId, JSON.stringify(item));
    } catch (e) {
      this.evictOldest(20);
      try {
        localStorage.setItem(
          STORAGE_PREFIX + item.trackId,
          JSON.stringify(item),
        );
      } catch {}
    }
  }

  private touch(trackId: string) {
    const index = this.getIndex().filter((id) => id !== trackId);
    index.push(trackId);
    if (index.length > MAX_ENTRIES) {
      const toEvict = index.splice(0, index.length - MAX_ENTRIES);
      for (const oldId of toEvict) {
        this.memCache.delete(oldId);
        try {
          localStorage.removeItem(STORAGE_PREFIX + oldId);
        } catch {}
      }
    }
    this.saveIndex(index);
  }

  private evictOldest(count: number) {
    const index = this.getIndex();
    const toEvict = index.splice(0, count);
    for (const oldId of toEvict) {
      this.memCache.delete(oldId);
      try {
        localStorage.removeItem(STORAGE_PREFIX + oldId);
      } catch {}
    }
    this.saveIndex(index);
  }

  clear() {
    const index = this.getIndex();
    for (const id of index) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + id);
      } catch {}
    }
    this.saveIndex([]);
    this.memCache.clear();
  }

  getStats(): { count: number; bytes: number } {
    let bytes = 0;
    const index = this.getIndex();
    for (const id of index) {
      const raw = localStorage.getItem(STORAGE_PREFIX + id);
      if (raw) {
        bytes += (STORAGE_PREFIX.length + id.length + raw.length) * 2;
      }
    }
    const idxRaw = localStorage.getItem(STORAGE_INDEX_KEY);
    if (idxRaw) {
      bytes += (STORAGE_INDEX_KEY.length + idxRaw.length) * 2;
    }
    return { count: index.length, bytes };
  }
}

export const lyricsCache = new LyricsCache();
