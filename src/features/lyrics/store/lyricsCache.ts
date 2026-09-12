import type { LyricsCandidate } from "@/shared/contracts/lyrics";
import type { LyricsProviderOption } from "./lyricsStore";

export interface CachedLyricsItem {
  trackId: string;
  candidate: LyricsCandidate;
  availableProviders?: LyricsProviderOption[];
  timestamp: number;
}

const STORAGE_INDEX_KEY = "liner_lyrics_lru_index";
const STORAGE_PREFIX = "liner_lyrics_item_";
const MAX_ENTRIES = 250;

class LyricsCache {
  private memCache = new Map<string, CachedLyricsItem>();

  constructor() {
    this.hydrateIndex();
  }

  private hydrateIndex() {
    try {
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

  private loadFromStorage(trackId: string): CachedLyricsItem | null {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + trackId);
      if (!raw) return null;
      const parsed: CachedLyricsItem = JSON.parse(raw);
      this.memCache.set(trackId, parsed);
      return parsed;
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
    if (item.candidate.syncLevel !== "word_level" && item.candidate.syncLevel !== "syllable_level") {
      return null;
    }
    this.touch(trackId);
    return item;
  }

  has(trackId: string): boolean {
    return Boolean(this.get(trackId));
  }

  set(
    trackId: string,
    candidate: LyricsCandidate,
    availableProviders?: LyricsProviderOption[],
  ) {
    if (candidate.syncLevel !== "word_level" && candidate.syncLevel !== "syllable_level") {
      return;
    }
    const item: CachedLyricsItem = {
      trackId,
      candidate,
      availableProviders,
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
        localStorage.setItem(STORAGE_PREFIX + item.trackId, JSON.stringify(item));
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
