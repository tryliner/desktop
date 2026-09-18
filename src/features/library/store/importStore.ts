import { create } from "zustand";
import { api, type ImportJob } from "@/shared/api";
import { showToast } from "@/shared/ui";
import { createTranslatorSync, getStoredLocale } from "@/languages";
import { notifyLibraryChanged } from "../hooks/usePlaylists";
import type { TrackDetail } from "./modalStore";

export interface ActiveImportState {
  job: ImportJob | null;
  isPolling: boolean;
  error: string | null;
  // track the caller wanted added to a playlist that is being created via
  // this import (see CreatePlaylistModal); added once the job completes
  pendingTrack: TrackDetail | null;
  startImport: (url: string, pendingTrack?: TrackDetail | null) => Promise<ImportJob>;
  listenToWebSocketWorker: (job: ImportJob) => void;
  pollJob: (jobId: string) => Promise<void>;
  cancelPolling: () => void;
  reset: () => void;
}

let activeWebSocket: WebSocket | null = null;
let activeAbortController: AbortController | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function cleanupActiveConnections() {
  if (activeWebSocket) {
    try {
      activeWebSocket.onopen = null;
      activeWebSocket.onmessage = null;
      activeWebSocket.onerror = null;
      activeWebSocket.onclose = null;
      activeWebSocket.close();
    } catch {}
    activeWebSocket = null;
  }
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

export const useImportStore = create<ActiveImportState>((set, get) => ({
  job: null,
  isPolling: false,
  error: null,
  pendingTrack: null,

  reset: () => {
    cleanupActiveConnections();
    set({ job: null, isPolling: false, error: null, pendingTrack: null });
  },

  cancelPolling: () => {
    cleanupActiveConnections();
    set({ isPolling: false });
  },

  startImport: async (url: string, pendingTrack: TrackDetail | null = null) => {
    get().cancelPolling();
    set({ error: null, isPolling: true, pendingTrack });
    try {
      const job = await api.createPlaylistImport(url);
      set({ job, isPolling: true });

      if (job.workerWsUrl && job.importToken) {
        get().listenToWebSocketWorker(job);
      } else {
        set({ error: "Import worker unavailable", isPolling: false, pendingTrack: null });
      }
      return job;
    } catch (err) {
      // store stays generic, callers map the raw error to a friendly message
      set({ error: "Failed to start import", isPolling: false, pendingTrack: null });
      throw err;
    }
  },

  listenToWebSocketWorker: (job: ImportJob) => {
    cleanupActiveConnections();
    set({ isPolling: true });

    let isFinished = false;
    let ws: WebSocket;

    try {
      const wsUrl = new URL(job.workerWsUrl!);
      wsUrl.searchParams.set("token", job.importToken!);
      const protocol = wsUrl.protocol === "https:" ? "wss:" : wsUrl.protocol === "http:" ? "ws:" : wsUrl.protocol;
      const targetUrl = `${protocol}//${wsUrl.host}${wsUrl.pathname}${wsUrl.search}`;

      ws = new WebSocket(targetUrl);
      activeWebSocket = ws;
    } catch {
      set({ error: "Failed to connect to import service", isPolling: false });
      cleanupActiveConnections();
      return;
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "job") {
          const current: ImportJob = {
            id: msg.id || job.id,
            source: msg.source || job.source,
            sourceUrl: msg.sourceUrl || job.sourceUrl,
            title: msg.title || job.title,
            description: msg.description || job.description,
            status: msg.status,
            queuePosition: typeof msg.queuePosition === "number" ? msg.queuePosition : undefined,
            requiresDecision: Boolean(msg.requiresDecision),
            playlistId: msg.playlistId,
            result: msg.result,
            error: msg.error,
            createdAt: msg.createdAt || job.createdAt,
          };

          set({ job: current });

          if (current.status === "awaiting_decision") {
            isFinished = true;
            set({ isPolling: false, job: current });
            cleanupActiveConnections();
            return;
          }

          if (current.status === "completed") {
            isFinished = true;
            cleanupActiveConnections();

            // sync final playlist id from backend if created asynchronously via redis
            if (!current.playlistId) {
              void (async () => {
                for (let i = 0; i < 5; i++) {
                  try {
                    const synced = await api.getPlaylistImport(job.id);
                    if (synced.playlistId || synced.status === "completed") {
                      set({ isPolling: false, job: synced });
                      notifyLibraryChanged();
                      return;
                    }
                  } catch {}
                  await new Promise((r) => setTimeout(r, 600));
                }
                set({ isPolling: false, job: current });
                notifyLibraryChanged();
              })();
            } else {
              set({ isPolling: false, job: current });
              notifyLibraryChanged();
            }
            return;
          }

          if (current.status === "failed") {
            isFinished = true;
            set({ isPolling: false, job: current, error: current.error?.message || "Import failed" });
            cleanupActiveConnections();
            return;
          }
        }
      } catch {}
    };

    ws.onerror = () => {
      if (isFinished) return;
      cleanupActiveConnections();
      set({ isPolling: false, error: "Import service connection error" });
    };

    ws.onclose = () => {
      if (isFinished) return;
      cleanupActiveConnections();
      set({ isPolling: false, error: "Import service disconnected" });
    };
  },

  pollJob: async (jobId: string) => {
    if (pollTimer) clearTimeout(pollTimer);

    try {
      const current = await api.getPlaylistImport(jobId);
      set({ job: current });

      if (current.status === "awaiting_decision") {
        set({ isPolling: false, job: current });
        return;
      }

      if (current.status === "completed") {
        set({ isPolling: false, job: current });
        notifyLibraryChanged();
        return;
      }

      if (current.status === "failed") {
        set({ isPolling: false, job: current, error: "Import failed" });
        return;
      }

      pollTimer = setTimeout(() => {
        void get().pollJob(jobId);
      }, 1000);
    } catch {
      pollTimer = setTimeout(() => {
        void get().pollJob(jobId);
      }, 2500);
    }
  },
}));

let lastHandledCompletedJobId: string | null = null;

useImportStore.subscribe((state) => {
  const { job, pendingTrack } = state;
  if (!job || job.status !== "completed" || !job.playlistId || !pendingTrack) return;
  if (job.id === lastHandledCompletedJobId) return;
  lastHandledCompletedJobId = job.id;

  useImportStore.setState({ pendingTrack: null });

  void (async () => {
    const translate = createTranslatorSync(getStoredLocale());
    try {
      await api.addPlaylistTrack(job.playlistId as string, pendingTrack.id);
      notifyLibraryChanged();
      showToast(translate("common.added_to_playlist"), "checkmark", {
        description: pendingTrack.title || undefined,
      });
    } catch {
      showToast(translate("common.failed_add_playlist"), "error");
    }
  })();
});
