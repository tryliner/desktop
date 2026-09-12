import { linerDb } from "./linerDb";

class AudioCache {
  private activeUrls = new Map<string, string>();

  async getAudioSrc(trackId: string): Promise<string | null> {
    if (this.activeUrls.has(trackId)) {
      return this.activeUrls.get(trackId)!;
    }

    const record = await linerDb.getAudio(trackId);
    if (!record) return null;

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
