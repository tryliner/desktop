import type { Track } from "@/shared/types";
import { audioCache } from "@/shared/storage/audioCache";
import { linerDb } from "@/shared/storage/linerDb";

export class MockOfflineEnvironment {
  private originalOnLine: boolean = true;
  private isInstalled: boolean = false;
  private currentOnlineState: boolean = true;
  private networkFailureSimulated: boolean = false;
  private simulatedMaxStorageBytes: number = 100 * 1024 * 1024; // 100MB default

  public install(): void {
    if (this.isInstalled) return;
    this.originalOnLine = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.currentOnlineState = true;
    this.setOnline(true);
    this.isInstalled = true;
  }

  public uninstall(): void {
    if (!this.isInstalled) return;
    this.setOnline(this.originalOnLine);
    this.networkFailureSimulated = false;
    this.isInstalled = false;
  }

  public isOnline(): boolean {
    return this.currentOnlineState;
  }

  public setOnline(online: boolean): void {
    this.currentOnlineState = online;
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      Object.defineProperty(navigator, "onLine", {
        value: online,
        configurable: true,
      });
      window.dispatchEvent(new Event(online ? "online" : "offline"));
    }
  }

  public simulateNetworkDrop(): void {
    this.setOnline(false);
  }

  public simulateNetworkRestore(): void {
    this.setOnline(true);
  }

  public setSimulateNetworkFailure(fail: boolean): void {
    this.networkFailureSimulated = fail;
  }

  public setStorageLimitBytes(bytes: number): void {
    this.simulatedMaxStorageBytes = bytes;
  }

  public getStorageLimitBytes(): number {
    return this.simulatedMaxStorageBytes;
  }

  /**
   * Simulates cache save with quota enforcement
   */
  public async cacheTrackAudio(trackId: string, content: string = "mock audio data"): Promise<{ success: boolean; evictedTracks: string[] }> {
    const blob = new Blob([content], { type: "audio/webm" });
    const currentTotal = await linerDb.getTotalAudioBytes();
    const evicted: string[] = [];

    // Check if adding exceeds simulated quota
    if (currentTotal + blob.size > this.simulatedMaxStorageBytes) {
      // Simulate LRU eviction of oldest audio
      // In tests, we can retrieve existing audio and evict
      const allAudio = (linerDb as any).memAudio as Map<string, { trackId: string; blob: Blob; timestamp: number }> | undefined;
      if (allAudio && allAudio.size > 0) {
        // Sort by timestamp ascending
        const sorted = Array.from(allAudio.values()).sort((a, b) => a.timestamp - b.timestamp);
        let freedBytes = 0;
        for (const item of sorted) {
          if (currentTotal - freedBytes + blob.size <= this.simulatedMaxStorageBytes) break;
          await audioCache.deleteAudio(item.trackId);
          evicted.push(item.trackId);
          freedBytes += item.blob.size;
        }
      }
    }

    const saved = await audioCache.saveAudioBlob(trackId, blob, "audio/webm");
    return { success: saved, evictedTracks: evicted };
  }

  /**
   * Stream resolver simulator honoring online/offline status and cache
   */
  public async resolveAudioStream(track: Track): Promise<{
    url: string;
    fromCache: boolean;
    mimeType: string;
  }> {
    if (!this.currentOnlineState || this.networkFailureSimulated) {
      // Attempt cache hit
      const hasCached = await audioCache.hasAudio(track.id);
      if (!hasCached) {
        throw new Error(`OfflineError: Cannot stream track "${track.title}" (${track.id}) while offline. No cached audio available.`);
      }
      return {
        url: `blob:mock-cached-blob-${track.id}`,
        fromCache: true,
        mimeType: "audio/webm",
      };
    }

    // Online resolution
    return {
      url: `https://stream.liner.fun/audio/${encodeURIComponent(track.id)}.webm`,
      fromCache: false,
      mimeType: "audio/webm",
    };
  }
}

export const offlineMock = new MockOfflineEnvironment();
