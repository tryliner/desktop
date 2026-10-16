import type { Track } from "@/shared/types";
import type { LyricsCandidate, LyricsSyncLevel } from "@/shared/contracts/lyrics";
import type { LyricsProviderOption } from "@/features/lyrics/store/lyricsStore";
import {
  shouldCacheLyricsCandidate,
  compareLyricsCandidates,
} from "@/features/lyrics";

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
  lastPlayedAt?: number;
  // accounts that downloaded or played this file on this machine. the cache itself is
  // shared, but the offline "downloaded music" list only shows a user their own tracks.
  // records cached before this field existed have no owner and are never listed.
  ownerIds?: string[];
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
  providers?: Record<string, LyricsCandidate>;
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
const DB_VERSION = 4;

class LinerDb {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSupported = typeof indexedDB !== "undefined";

  private memTracks = new Map<string, CachedTrackRecord>();
  private memAudio = new Map<string, CachedAudioRecord>();
  private memLyrics = new Map<string, CachedLyricsRecord>();
  private memArtists = new Map<string, CachedArtistRecord>();

  private handleDbError(err: unknown) {
    this.dbPromise = null;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.isSupported) {
      return Promise.reject(new Error("IndexedDB is not available"));
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        this.dbPromise = null;
        reject(err);
        return;
      }

      request.onupgradeneeded = (event) => {
        const db = request.result;

        if (!db.objectStoreNames.contains("tracks")) {
          const trackStore = db.createObjectStore("tracks", { keyPath: "id" });
          trackStore.createIndex("savedAt", "savedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("audio")) {
          const audioStore = db.createObjectStore("audio", { keyPath: "trackId" });
          audioStore.createIndex("savedAt", "savedAt", { unique: false });
          audioStore.createIndex("byteSize", "byteSize", { unique: false });
          audioStore.createIndex("lastPlayedAt", "lastPlayedAt", { unique: false });
        } else {
          const audioStore = request.transaction?.objectStore("audio");
          if (audioStore && !audioStore.indexNames.contains("lastPlayedAt")) {
            audioStore.createIndex("lastPlayedAt", "lastPlayedAt", { unique: false });
          }
        }

        if (!db.objectStoreNames.contains("lyrics")) {
          const lyricsStore = db.createObjectStore("lyrics", { keyPath: "trackId" });
          lyricsStore.createIndex("lastCheckedAt", "lastCheckedAt", { unique: false });
          lyricsStore.createIndex("syncLevel", "syncLevel", { unique: false });
        } else if (event.oldVersion < 4) {
          // clear legacy lyrics store on v4 migration
          try {
            request.transaction?.objectStore("lyrics").clear();
          } catch {}
        }

        if (!db.objectStoreNames.contains("artists")) {
          const artistStore = db.createObjectStore("artists", { keyPath: "id" });
          artistStore.createIndex("lastCheckedAt", "lastCheckedAt", { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          this.dbPromise = null;
        };
        db.onversionchange = () => {
          try {
            db.close();
          } catch {}
          this.dbPromise = null;
        };
        db.onerror = () => {
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        this.dbPromise = null;
      };
    });

    return this.dbPromise;
  }

  // executes indexeddb transaction with one auto-reconnect retry and zero unhandled rejections
  private async runTransaction<T>(
    storeName: "tracks" | "audio" | "lyrics" | "artists",
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T | null> {
    if (!this.isSupported) return null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const db = await this.open();
        return await new Promise<T>((resolve, reject) => {
          try {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error("tx aborted"));
            operation(store).then(resolve, reject);
          } catch (err) {
            reject(err);
          }
        });
      } catch (err) {
        this.handleDbError(err);
        if (attempt === 0) {
          // retry once on fresh connection
          continue;
        }
      }
    }
    return null;
  }

  async getTrack(id: string): Promise<CachedTrackRecord | null> {
    const mem = this.memTracks.get(id);
    if (mem) return mem;

    const result = await this.runTransaction("tracks", "readonly", (store) => {
      return new Promise<CachedTrackRecord | null>((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    });

    if (result) {
      this.memTracks.set(id, result);
      return result;
    }
    return this.memTracks.get(id) || null;
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

    await this.runTransaction("tracks", "readwrite", (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getTotalTrackBytes(): Promise<number> {
    const result = await this.runTransaction("tracks", "readonly", (store) => {
      return new Promise<number>((resolve) => {
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CachedTrackRecord;
            total += JSON.stringify(val || {}).length * 2;
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      });
    });

    if (result !== null && result !== undefined) {
      return result;
    }

    let total = 0;
    for (const item of this.memTracks.values()) {
      total += JSON.stringify(item || {}).length * 2;
    }
    return total;
  }

  async getAudio(trackId: string): Promise<CachedAudioRecord | null> {
    const mem = this.memAudio.get(trackId);
    if (mem) return mem;

    const result = await this.runTransaction("audio", "readonly", (store) => {
      return new Promise<CachedAudioRecord | null>((resolve) => {
        const req = store.get(trackId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    });

    if (result) {
      this.memAudio.set(trackId, result);
      return result;
    }
    return this.memAudio.get(trackId) || null;
  }

  async putAudio(
    trackId: string,
    blob: Blob,
    mimeType: string,
    lastPlayedAt?: number,
    ownerId?: string | null,
  ): Promise<void> {
    const existing = this.memAudio.get(trackId) ?? (await this.getAudio(trackId));
    const now = Date.now();
    const ownerIds = mergeOwner(existing?.ownerIds, ownerId);
    const record: CachedAudioRecord = {
      trackId,
      blob,
      mimeType,
      byteSize: blob.size,
      savedAt: existing?.savedAt ?? now,
      lastPlayedAt: lastPlayedAt ?? now,
      ...(ownerIds ? { ownerIds } : {}),
    };
    this.memAudio.set(trackId, record);

    await this.runTransaction("audio", "readwrite", (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  // a cached file played by another account on this machine becomes theirs too
  async addAudioOwner(trackId: string, ownerId: string | null | undefined): Promise<void> {
    if (!ownerId) return;
    const record = await this.getAudio(trackId);
    if (!record || record.ownerIds?.includes(ownerId)) return;
    const updated: CachedAudioRecord = {
      ...record,
      ownerIds: mergeOwner(record.ownerIds, ownerId),
    };
    this.memAudio.set(trackId, updated);

    await this.runTransaction("audio", "readwrite", (store) => {
      return new Promise<void>((resolve) => {
        const req = store.put(updated);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    });
  }

  async touchAudio(trackId: string): Promise<void> {
    const record = await this.getAudio(trackId);
    if (!record) return;
    record.lastPlayedAt = Date.now();
    this.memAudio.set(trackId, record);

    await this.runTransaction("audio", "readwrite", (store) => {
      return new Promise<void>((resolve) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    });
  }

  async getOldestAudioRecords(): Promise<CachedAudioRecord[]> {
    const result = await this.runTransaction("audio", "readonly", (store) => {
      return new Promise<CachedAudioRecord[]>((resolve) => {
        const records: CachedAudioRecord[] = [];
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            records.push(cursor.value as CachedAudioRecord);
            cursor.continue();
          } else {
            records.sort((a, b) => (a.lastPlayedAt ?? a.savedAt) - (b.lastPlayedAt ?? b.savedAt));
            resolve(records);
          }
        };
        req.onerror = () => resolve([]);
      });
    });

    if (result && result.length > 0) {
      return result;
    }

    const memList = Array.from(this.memAudio.values());
    memList.sort((a, b) => (a.lastPlayedAt ?? a.savedAt) - (b.lastPlayedAt ?? b.savedAt));
    return memList;
  }

  async hasAudio(trackId: string): Promise<boolean> {
    if (this.memAudio.has(trackId)) return true;

    const result = await this.runTransaction("audio", "readonly", (store) => {
      return new Promise<boolean>((resolve) => {
        const req = store.count(IDBKeyRange.only(trackId));
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      });
    });

    return result ?? this.memAudio.has(trackId);
  }

  async deleteAudio(trackId: string): Promise<void> {
    this.memAudio.delete(trackId);

    await this.runTransaction("audio", "readwrite", (store) => {
      return new Promise<void>((resolve) => {
        const req = store.delete(trackId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    });
  }

  async getTotalAudioBytes(): Promise<number> {
    const result = await this.runTransaction("audio", "readonly", (store) => {
      return new Promise<number>((resolve) => {
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CachedAudioRecord;
            total += val.byteSize || val.blob?.size || 0;
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      });
    });

    if (result !== null && result !== undefined) {
      return result;
    }

    let total = 0;
    for (const item of this.memAudio.values()) {
      total += item.byteSize || 0;
    }
    return total;
  }

  // tracks of one account that have both metadata and a cached audio file,
  // most recently played first. reads the audio records but never their blobs.
  async getDownloadedTracks(ownerId: string | null | undefined): Promise<CachedTrackRecord[]> {
    if (!ownerId) return [];

    const owned = await this.runTransaction("audio", "readonly", (store) => {
      return new Promise<{ trackId: string; at: number }[]>((resolve) => {
        const items: { trackId: string; at: number }[] = [];
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CachedAudioRecord;
            if (val?.ownerIds?.includes(ownerId)) {
              items.push({ trackId: val.trackId, at: val.lastPlayedAt ?? val.savedAt ?? 0 });
            }
            cursor.continue();
          } else {
            resolve(items);
          }
        };
        req.onerror = () => resolve(items);
      });
    });

    const ids = (
      owned ??
      Array.from(this.memAudio.values())
        .filter((r) => r.ownerIds?.includes(ownerId))
        .map((r) => ({ trackId: r.trackId, at: r.lastPlayedAt ?? r.savedAt ?? 0 }))
    )
      .sort((a, b) => b.at - a.at)
      .map((item) => item.trackId);

    if (ids.length === 0) return [];

    const stored = await this.runTransaction("tracks", "readonly", (store) => {
      return new Promise<CachedTrackRecord[]>((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as CachedTrackRecord[]) || []);
        req.onerror = () => resolve([]);
      });
    });

    const byId = new Map<string, CachedTrackRecord>();
    for (const record of stored ?? []) {
      if (record?.id) byId.set(record.id, record);
    }
    for (const [id, record] of this.memTracks) byId.set(id, record);

    const tracks: CachedTrackRecord[] = [];
    for (const id of ids) {
      const track = byId.get(id);
      if (track) tracks.push(track);
    }
    return tracks;
  }

  async getLyrics(trackId: string): Promise<CachedLyricsRecord | null> {
    const mem = this.memLyrics.get(trackId);
    if (mem) return mem;

    const result = await this.runTransaction("lyrics", "readonly", (store) => {
      return new Promise<CachedLyricsRecord | null>((resolve) => {
        const req = store.get(trackId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    });

    if (result) {
      if (!result.providers) {
        result.providers = {};
        if (result.candidate) {
          result.providers[result.candidate.provider.toLowerCase().trim()] =
            result.candidate;
        }
        if (result.availableProviders) {
          for (const opt of result.availableProviders) {
            if (opt.candidate) {
              result.providers[opt.provider.toLowerCase().trim()] =
                opt.candidate;
            }
          }
        }
      }
      this.memLyrics.set(trackId, result);
      return result;
    }
    return this.memLyrics.get(trackId) || null;
  }

  async putLyrics(record: CachedLyricsRecord): Promise<void> {
    const providers: Record<string, LyricsCandidate> = {
      ...(record.providers || {}),
    };

    if (record.candidate && shouldCacheLyricsCandidate(record.candidate)) {
      providers[record.candidate.provider.toLowerCase().trim()] =
        record.candidate;
    }

    if (record.availableProviders) {
      for (const opt of record.availableProviders) {
        if (opt.candidate && shouldCacheLyricsCandidate(opt.candidate)) {
          providers[opt.candidate.provider.toLowerCase().trim()] =
            opt.candidate;
        }
      }
    }

    const validCandidates = Object.values(providers).filter(
      shouldCacheLyricsCandidate,
    );
    if (validCandidates.length === 0) {
      return;
    }

    const validOptions: LyricsProviderOption[] = validCandidates
      .map((c) => ({
        provider: c.provider,
        syncLevel: c.syncLevel,
        quality: c.quality.total,
        candidate: c,
      }))
      .sort((a, b) => compareLyricsCandidates(a.candidate, b.candidate));

    const primaryCandidate =
      record.candidate && shouldCacheLyricsCandidate(record.candidate)
        ? record.candidate
        : validOptions[0].candidate;

    const sanitizedRecord: CachedLyricsRecord = {
      ...record,
      syncLevel: primaryCandidate.syncLevel,
      quality: primaryCandidate.quality.total,
      activeProvider: primaryCandidate.provider,
      rawLyrics: primaryCandidate.lyrics.content,
      rawFormat: primaryCandidate.lyrics.format,
      candidate: primaryCandidate,
      providers,
      availableProviders: validOptions,
    };

    this.memLyrics.set(record.trackId, sanitizedRecord);

    await this.runTransaction("lyrics", "readwrite", (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put(sanitizedRecord);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async updateLyricsChecked(trackId: string): Promise<void> {
    const existing = await this.getLyrics(trackId);
    if (!existing) return;
    existing.lastCheckedAt = Date.now();
    await this.putLyrics(existing);
  }

  async getTotalLyricsBytes(): Promise<number> {
    const result = await this.runTransaction("lyrics", "readonly", (store) => {
      return new Promise<number>((resolve) => {
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const val = cursor.value as CachedLyricsRecord;
            let recordBytes = 0;
            if (val.providers) {
              for (const cand of Object.values(val.providers)) {
                recordBytes += (cand.lyrics?.content?.length || 0) * 2;
              }
            } else {
              recordBytes = (val.rawLyrics?.length || 0) * 2;
            }
            total += recordBytes;
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        req.onerror = () => resolve(0);
      });
    });

    if (result !== null && result !== undefined) {
      return result;
    }

    let total = 0;
    for (const item of this.memLyrics.values()) {
      let recordBytes = 0;
      if (item.providers) {
        for (const cand of Object.values(item.providers)) {
          recordBytes += (cand.lyrics?.content?.length || 0) * 2;
        }
      } else {
        recordBytes = (item.rawLyrics?.length || 0) * 2;
      }
      total += recordBytes;
    }
    return total;
  }

  async getArtist(id: string): Promise<CachedArtistRecord | null> {
    const mem = this.memArtists.get(id);
    if (mem) return mem;

    const result = await this.runTransaction("artists", "readonly", (store) => {
      return new Promise<CachedArtistRecord | null>((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    });

    if (result) {
      this.memArtists.set(id, result);
      return result;
    }
    return this.memArtists.get(id) || null;
  }

  async putArtist(record: CachedArtistRecord): Promise<void> {
    this.memArtists.set(record.id, record);

    await this.runTransaction("artists", "readwrite", (store) => {
      return new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async updateArtistChecked(id: string): Promise<void> {
    const existing = await this.getArtist(id);
    if (!existing) return;
    existing.lastCheckedAt = Date.now();
    await this.putArtist(existing);
  }

  async getTotalArtistBytes(): Promise<number> {
    const result = await this.runTransaction("artists", "readonly", (store) => {
      return new Promise<number>((resolve) => {
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
    });

    if (result !== null && result !== undefined) {
      return result;
    }

    let total = 0;
    for (const item of this.memArtists.values()) {
      total += JSON.stringify(item.data || {}).length * 2;
    }
    return total;
  }

  async clearStore(storeName: "tracks" | "audio" | "lyrics" | "artists"): Promise<void> {
    if (storeName === "tracks") this.memTracks.clear();
    if (storeName === "audio") this.memAudio.clear();
    if (storeName === "lyrics") this.memLyrics.clear();
    if (storeName === "artists") this.memArtists.clear();

    await this.runTransaction(storeName, "readwrite", (store) => {
      return new Promise<void>((resolve) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.dbPromise) {
      try {
        const db = await this.dbPromise;
        db.close();
      } catch {}
      this.dbPromise = null;
    }
  }

  async clearAll(): Promise<void> {
    this.memTracks.clear();
    this.memAudio.clear();
    this.memLyrics.clear();
    this.memArtists.clear();
    await this.clearStore("audio");
    await this.clearStore("tracks");
    await this.clearStore("lyrics");
    await this.clearStore("artists");
  }
}

function mergeOwner(ownerIds: string[] | undefined, ownerId: string | null | undefined): string[] | undefined {
  if (!ownerId) return ownerIds;
  if (ownerIds?.includes(ownerId)) return ownerIds;
  return [...(ownerIds ?? []), ownerId];
}

export const linerDb = new LinerDb();
