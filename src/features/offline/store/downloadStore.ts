import { create } from "zustand";
import { audioCache } from "@/shared/storage/audioCache";

export type DownloadStatus = "idle" | "queued" | "downloading" | "complete" | "error";

export interface DownloadItem {
  trackId: string;
  status: DownloadStatus;
  progress: number; // 0-100
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface DownloadState {
  downloads: Map<string, DownloadItem>;
  activeCount: number;
  maxConcurrent: number;
  queueDownload: (trackId: string) => void;
  queuePlaylistDownloads: (trackIds: string[]) => void;
  cancelDownload: (trackId: string) => void;
  clearCompleted: () => void;
  getStatus: (trackId: string) => DownloadStatus;
}

const abortControllers = new Map<string, AbortController>();

function processQueue(set: any, get: () => DownloadState): void {
  const state = get();
  if (state.activeCount >= state.maxConcurrent) return;

  const queued = Array.from(state.downloads.values()).find((d) => d.status === "queued");
  if (!queued) return;

  const trackId = queued.trackId;
  const controller = new AbortController();
  abortControllers.set(trackId, controller);

  const downloads = new Map(get().downloads);
  downloads.set(trackId, {
    ...queued,
    status: "downloading",
    progress: 0,
    startedAt: Date.now(),
  });
  set({ downloads, activeCount: get().activeCount + 1 });

  executeDownload(trackId, controller.signal, set, get);
}

async function executeDownload(
  trackId: string,
  signal: AbortSignal,
  set: any,
  get: () => DownloadState,
): Promise<void> {
  try {
    // Use fetch with signal for cancellation support
    const streamUrl = await resolveDownloadUrl(trackId);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const response = await fetch(streamUrl, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentLength = Number(response.headers.get("content-length") || 0);
    const reader = response.body?.getReader();

    if (!reader) {
      // Fallback: no streaming, read whole blob
      const blob = await response.blob();
      const mimeType = response.headers.get("content-type") || "audio/ogg";
      const generation = audioCache.currentGeneration();
      await audioCache.saveAudioBlob(trackId, blob, mimeType, generation);
      finishDownload(trackId, set, get);
      return;
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.length;

      const progress = contentLength > 0 ? Math.min(99, Math.round((receivedBytes / contentLength) * 100)) : 50;
      const downloads = new Map(get().downloads);
      const existing = downloads.get(trackId);
      if (existing && existing.status === "downloading") {
        downloads.set(trackId, { ...existing, progress });
        set({ downloads });
      }
    }

    const mimeType = response.headers.get("content-type") || "audio/ogg";
    const blob = new Blob(chunks as unknown as BlobPart[], { type: mimeType });
    const generation = audioCache.currentGeneration();
    await audioCache.saveAudioBlob(trackId, blob, mimeType, generation);

    finishDownload(trackId, set, get);
  } catch (err: unknown) {
    abortControllers.delete(trackId);
    const isAbort = err instanceof DOMException && err.name === "AbortError";

    if (isAbort) {
      // Already cleaned up in cancelDownload
      return;
    }

    const downloads = new Map(get().downloads);
    const existing = downloads.get(trackId);
    if (existing) {
      downloads.set(trackId, {
        ...existing,
        status: "error",
        progress: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    set({ downloads, activeCount: Math.max(0, get().activeCount - 1) });
    processQueue(set, get);
  }
}

function finishDownload(trackId: string, set: any, get: () => DownloadState): void {
  abortControllers.delete(trackId);
  const downloads = new Map(get().downloads);
  const existing = downloads.get(trackId);
  if (existing) {
    downloads.set(trackId, {
      ...existing,
      status: "complete",
      progress: 100,
      completedAt: Date.now(),
    });
  }
  set({ downloads, activeCount: Math.max(0, get().activeCount - 1) });
  processQueue(set, get);
}

/**
 * Resolve a download URL for a track.
 * In production this would go through streamResolver or a dedicated endpoint.
 * For now we construct a simple placeholder that the test layer can mock via fetch.
 */
async function resolveDownloadUrl(trackId: string): Promise<string> {
  // This could be extended to call resolvePlaybackStream and extract the URL.
  // For the download use-case we just need any resolvable audio URL for the track.
  return `/api/audio/${encodeURIComponent(trackId)}`;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: new Map<string, DownloadItem>(),
  activeCount: 0,
  maxConcurrent: 3,

  queueDownload: (trackId: string) => {
    const existing = get().downloads.get(trackId);
    if (existing && (existing.status === "queued" || existing.status === "downloading" || existing.status === "complete")) {
      return;
    }

    const downloads = new Map(get().downloads);
    downloads.set(trackId, {
      trackId,
      status: "queued",
      progress: 0,
    });
    set({ downloads });
    processQueue(set, get);
  },

  queuePlaylistDownloads: (trackIds: string[]) => {
    const downloads = new Map(get().downloads);
    for (const trackId of trackIds) {
      const existing = downloads.get(trackId);
      if (existing && (existing.status === "queued" || existing.status === "downloading" || existing.status === "complete")) {
        continue;
      }
      downloads.set(trackId, {
        trackId,
        status: "queued",
        progress: 0,
      });
    }
    set({ downloads });
    processQueue(set, get);
  },

  cancelDownload: (trackId: string) => {
    const controller = abortControllers.get(trackId);
    if (controller) {
      controller.abort();
      abortControllers.delete(trackId);
    }

    const downloads = new Map(get().downloads);
    const existing = downloads.get(trackId);
    if (existing) {
      const wasActive = existing.status === "downloading";
      downloads.delete(trackId);
      set({
        downloads,
        activeCount: wasActive ? Math.max(0, get().activeCount - 1) : get().activeCount,
      });
      if (wasActive) processQueue(set, get);
    }
  },

  clearCompleted: () => {
    const downloads = new Map(get().downloads);
    for (const [id, item] of downloads) {
      if (item.status === "complete" || item.status === "error") {
        downloads.delete(id);
      }
    }
    set({ downloads });
  },

  getStatus: (trackId: string): DownloadStatus => {
    return get().downloads.get(trackId)?.status ?? "idle";
  },
}));
