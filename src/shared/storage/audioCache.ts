import { linerDb } from "./linerDb";

export const AUDIO_CACHE_LIMIT_STORAGE_KEY = "liner_audio_cache_limit_bytes";
export const DEFAULT_AUDIO_CACHE_LIMIT_BYTES = 3 * 1024 * 1024 * 1024;
export const MIN_AUDIO_CACHE_LIMIT_BYTES = 250 * 1024 * 1024;

class AudioCache {
  private activeUrls = new Map<string, string>();

  getLimitBytes(): number {
    if (typeof window === "undefined" || !window.localStorage) {
      return DEFAULT_AUDIO_CACHE_LIMIT_BYTES;
    }
    const val = localStorage.getItem(AUDIO_CACHE_LIMIT_STORAGE_KEY);
    if (!val) return DEFAULT_AUDIO_CACHE_LIMIT_BYTES;
    const num = parseInt(val, 10);
    if (isNaN(num)) return DEFAULT_AUDIO_CACHE_LIMIT_BYTES;
    if (num === 0) return 0;
    return Math.max(MIN_AUDIO_CACHE_LIMIT_BYTES, num);
  }

  async setLimitBytes(bytes: number): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      if (bytes === 0) {
        localStorage.setItem(AUDIO_CACHE_LIMIT_STORAGE_KEY, "0");
      } else {
        const clamped = Math.max(MIN_AUDIO_CACHE_LIMIT_BYTES, bytes);
        localStorage.setItem(AUDIO_CACHE_LIMIT_STORAGE_KEY, String(clamped));
      }
    }
    await this.enforceCacheLimit();
  }

  async enforceCacheLimit(customLimit?: number): Promise<number> {
    const limit = customLimit !== undefined ? customLimit : this.getLimitBytes();
    if (limit <= 0) return 0;

    const totalBytes = await linerDb.getTotalAudioBytes();
    if (totalBytes <= limit) return 0;

    const targetBytes = Math.floor(limit * 0.9);
    const bytesToEvict = totalBytes - targetBytes;
    let evictedBytes = 0;

    const oldest = await linerDb.getOldestAudioRecords();
    for (const item of oldest) {
      if (evictedBytes >= bytesToEvict) break;
      const size = item.byteSize || item.blob?.size || 0;
      await this.deleteAudio(item.trackId);
      evictedBytes += size;
    }

    return evictedBytes;
  }

  async getAudioSrc(trackId: string): Promise<string | null> {
    if (this.activeUrls.has(trackId)) {
      void linerDb.touchAudio(trackId);
      return this.activeUrls.get(trackId)!;
    }

    const record = await linerDb.getAudio(trackId);
    if (!record) return null;

    void linerDb.touchAudio(trackId);

    if (typeof URL !== "undefined" && URL.createObjectURL) {
      const objectUrl = URL.createObjectURL(record.blob);
      this.activeUrls.set(trackId, objectUrl);
      return objectUrl;
    }

    return null;
  }

  async saveAudioBlob(
    trackId: string,
    blob: Blob,
    mimeType: string = "audio/ogg",
  ): Promise<void> {
    await linerDb.putAudio(trackId, blob, mimeType);
    await this.enforceCacheLimit();
  }

  async saveAudioFromUrl(
    trackId: string,
    url: string,
    mimeType?: string,
  ): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const blob = await response.blob();
      const resolvedMime = mimeType || blob.type || "audio/ogg";
      await this.saveAudioBlob(trackId, blob, resolvedMime);
    } catch {}
  }

  async hasAudio(trackId: string): Promise<boolean> {
    return linerDb.hasAudio(trackId);
  }

  async deleteAudio(trackId: string): Promise<void> {
    this.revokeTrackUrl(trackId);
    await linerDb.deleteAudio(trackId);
  }

  revokeTrackUrl(trackId: string): void {
    const existing = this.activeUrls.get(trackId);
    if (existing && typeof URL !== "undefined" && URL.revokeObjectURL) {
      URL.revokeObjectURL(existing);
      this.activeUrls.delete(trackId);
    }
  }

  revokeAll(): void {
    if (typeof URL !== "undefined" && URL.revokeObjectURL) {
      for (const url of this.activeUrls.values()) {
        URL.revokeObjectURL(url);
      }
    }
    this.activeUrls.clear();
  }
}

export const audioCache = new AudioCache();
