import type { Track } from "@/shared/types";
import type { LyricsCandidate, LyricsSyncLevel } from "@/shared/contracts/lyrics";
import type { LyricsProviderOption } from "@/features/lyrics/store/lyricsStore";

export interface CachedTrackRecord {
  id: string;
  title: string;
  artists: string;
  albumTitle?: string;
  albumId?: string;
  coverUrl?: string;
  durationMs: number;
  savedAt: number;
}

export interface CachedAudioRecord {
  trackId: string;
  blob: Blob;
  mimeType: string;
  byteSize: number;
  savedAt: number;
}

export interface CachedLyricsRecord {
  trackId: string;
  syncLevel: LyricsSyncLevel;
  quality: number;
  activeProvider: string;
  availableProviders: LyricsProviderOption[];
  rawLyrics: string;
  rawFormat: string;
  candidate: LyricsCandidate;
  lastCheckedAt: number;
  updatedAt: number;
  userLocked?: boolean;
}

export interface CachedArtistRecord {
  id: string;
  data: any;
  savedAt: number;
  lastCheckedAt: number;
}

const DB_NAME = "liner_db_v1";
const DB_VERSION = 2;

class LinerDb {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSupported = typeof indexedDB !== "undefined";

  private memTracks = new Map<string, CachedTrackRecord>();
  private memAudio = new Map<string, CachedAudioRecord>();
  private memLyrics = new Map<string, CachedLyricsRecord>();
  private memArtists = new Map<string, CachedArtistRecord>();

  private open(): Promise<IDBDatabase> {
    if (!this.isSupported) {
      return Promise.reject(new Error("IndexedDB is not available"));
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("tracks")) {
          const trackStore = db.createObjectStore("tracks", { keyPath: "id" });
          trackStore.createIndex("savedAt", "savedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("audio")) {
          const audioStore = db.createObjectStore("audio", { keyPath: "trackId" });
          audioStore.createIndex("savedAt", "savedAt", { unique: false });
          audioStore.createIndex("byteSize", "byteSize", { unique: false });
        }

        if (!db.objectStoreNames.contains("lyrics")) {
          const lyricsStore = db.createObjectStore("lyrics", { keyPath: "trackId" });
          lyricsStore.createIndex("lastCheckedAt", "lastCheckedAt", { unique: false });
          lyricsStore.createIndex("syncLevel", "syncLevel", { unique: false });
        }

        if (!db.objectStoreNames.contains("artists")) {
          const artistStore = db.createObjectStore("artists", { keyPath: "id" });
          artistStore.createIndex("lastCheckedAt", "lastCheckedAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.isSupported = false;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async getTrack(id: string): Promise<CachedTrackRecord | null> {
    if (!this.isSupported) {
      return this.memTracks.get(id) || null;
    }
    try {
      const db = await this.open();
      return new Promise<CachedTrackRecord | null>((resolve) => {
        const tx = db.transaction("tracks", "readonly");
        const store = tx.objectStore("tracks");
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(this.memTracks.get(id) || null);
      });
    } catch {
      return this.memTracks.get(id) || null;
    }
  }

  async putTrack(track: Track): Promise<void> {
    const record: CachedTrackRecord = {
      id: track.id,
      title: track.title,
      artists: track.artists,
      albumTitle: track.album?.title,
      albumId: track.album?.id,
      coverUrl: track.coverUrl,
      durationMs: track.durationMs,
      savedAt: Date.now(),
    };
    this.memTracks.set(track.id, record);

    if (!this.isSupported) return;
    try {
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("tracks", "readwrite");
        const store = tx.objectStore("tracks");
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  async getAudio(trackId: string): Promise<CachedAudioRecord | null> {
    if (!this.isSupported) {
      return this.memAudio.get(trackId) || null;
    }
    try {
      const db = await this.open();
      return new Promise<CachedAudioRecord | null>((resolve) => {
        const tx = db.transaction("audio", "readonly");
        const store = tx.objectStore("audio");
        const req = store.get(trackId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(this.memAudio.get(trackId) || null);
      });
    } catch {
      return this.memAudio.get(trackId) || null;
    }
  }

  async putAudio(trackId: string, blob: Blob, mimeType: string): Promise<void> {
    const record: CachedAudioRecord = {
      trackId,
      blob,
      mimeType,
      byteSize: blob.size,
      savedAt: Date.now(),
    };
    this.memAudio.set(trackId, record);

    if (!this.isSupported) return;
    try {
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("audio", "readwrite");
        const store = tx.objectStore("audio");
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  async hasAudio(trackId: string): Promise<boolean> {
    if (!this.isSupported) {
      return this.memAudio.has(trackId);
    }
    try {
      const db = await this.open();
      return new Promise<boolean>((resolve) => {
        const tx = db.transaction("audio", "readonly");
        const store = tx.objectStore("audio");
        const req = store.count(IDBKeyRange.only(trackId));
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(this.memAudio.has(trackId));
      });
    } catch {
      return this.memAudio.has(trackId);
    }
  }

  async deleteAudio(trackId: string): Promise<void> {
    this.memAudio.delete(trackId);
    if (!this.isSupported) return;
    try {
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("audio", "readwrite");
        const store = tx.objectStore("audio");
        const req = store.delete(trackId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {}
  }

  async getTotalAudioBytes(): Promise<number> {
    if (!this.isSupported) {
      let total = 0;
      for (const item of this.memAudio.values()) {
        total += item.byteSize || 0;
      }
      return total;
    }
    try {
      const db = await this.open();
      return new Promise<number>((resolve) => {
        const tx = db.transaction("audio", "readonly");
        const store = tx.objectStore("audio");
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CachedAudioRecord;
            total += val.byteSize || 0;
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      });
    } catch {
      let total = 0;
      for (const item of this.memAudio.values()) {
        total += item.byteSize || 0;
      }
      return total;
    }
  }

  async getLyrics(trackId: string): Promise<CachedLyricsRecord | null> {
    if (!this.isSupported) {
      return this.memLyrics.get(trackId) || null;
    }
    try {
      const db = await this.open();
      return new Promise<CachedLyricsRecord | null>((resolve) => {
        const tx = db.transaction("lyrics", "readonly");
        const store = tx.objectStore("lyrics");
        const req = store.get(trackId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(this.memLyrics.get(trackId) || null);
      });
    } catch {
      return this.memLyrics.get(trackId) || null;
    }
  }

  async putLyrics(record: CachedLyricsRecord): Promise<void> {
    if (record.syncLevel !== "word_level" && record.syncLevel !== "syllable_level") {
      return;
    }
    this.memLyrics.set(record.trackId, record);
    if (!this.isSupported) return;
    try {
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("lyrics", "readwrite");
        const store = tx.objectStore("lyrics");
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  async updateLyricsChecked(trackId: string): Promise<void> {
    const existing = await this.getLyrics(trackId);
    if (!existing) return;
    existing.lastCheckedAt = Date.now();
    await this.putLyrics(existing);
  }

  async getTotalLyricsBytes(): Promise<number> {
    if (!this.isSupported) {
      let total = 0;
      for (const item of this.memLyrics.values()) {
        total += (item.rawLyrics?.length || 0) * 2;
      }
      return total;
    }
    try {
      const db = await this.open();
      return new Promise<number>((resolve) => {
        const tx = db.transaction("lyrics", "readonly");
        const store = tx.objectStore("lyrics");
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CachedLyricsRecord;
            total += (val.rawLyrics?.length || 0) * 2;
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      });
    } catch {
      let total = 0;
      for (const item of this.memLyrics.values()) {
        total += (item.rawLyrics?.length || 0) * 2;
      }
      return total;
    }
  }

  async getArtist(id: string): Promise<CachedArtistRecord | null> {
    if (!this.isSupported) {
      return this.memArtists.get(id) || null;
    }
    try {
      const db = await this.open();
      return new Promise<CachedArtistRecord | null>((resolve) => {
        const tx = db.transaction("artists", "readonly");
        const store = tx.objectStore("artists");
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(this.memArtists.get(id) || null);
      });
    } catch {
      return this.memArtists.get(id) || null;
    }
  }

  async putArtist(record: CachedArtistRecord): Promise<void> {
    this.memArtists.set(record.id, record);
    if (!this.isSupported) return;
    try {
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("artists", "readwrite");
        const store = tx.objectStore("artists");
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  async updateArtistChecked(id: string): Promise<void> {
    const existing = await this.getArtist(id);
    if (!existing) return;
    existing.lastCheckedAt = Date.now();
    await this.putArtist(existing);
  }

  async getTotalArtistBytes(): Promise<number> {
    if (!this.isSupported) {
      let total = 0;
      for (const item of this.memArtists.values()) {
        total += JSON.stringify(item.data || {}).length * 2;
      }
      return total;
    }
    try {
      const db = await this.open();
      return new Promise<number>((resolve) => {
        const tx = db.transaction("artists", "readonly");
        const store = tx.objectStore("artists");
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CachedArtistRecord;
            total += JSON.stringify(val.data || {}).length * 2;
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      });
    } catch {
      let total = 0;
      for (const item of this.memArtists.values()) {
        total += JSON.stringify(item.data || {}).length * 2;
      }
      return total;
    }
  }

  async clearStore(storeName: "tracks" | "audio" | "lyrics" | "artists"): Promise<void> {
    if (storeName === "tracks") this.memTracks.clear();
    if (storeName === "audio") this.memAudio.clear();
    if (storeName === "lyrics") this.memLyrics.clear();
    if (storeName === "artists") this.memArtists.clear();

    if (!this.isSupported) return;
    try {
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {}
  }

  async clearAll(): Promise<void> {
    await this.clearStore("audio");
    await this.clearStore("tracks");
    await this.clearStore("lyrics");
    await this.clearStore("artists");
  }
}

export const linerDb = new LinerDb();
