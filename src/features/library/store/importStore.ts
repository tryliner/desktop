import { create } from "zustand";
import { api, type ImportJob } from "@/shared/api";
import { notifyLibraryChanged } from "../hooks/usePlaylists";

export interface ActiveImportState {
  job: ImportJob | null;
  isPolling: boolean;
  error: string | null;
  startImport: (url: string) => Promise<ImportJob>;
  listenToJob: (jobId: string) => Promise<void>;
  pollJob: (jobId: string) => Promise<void>;
  cancelPolling: () => void;
  reset: () => void;
}

let activeAbortController: AbortController | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

export const useImportStore = create<ActiveImportState>((set, get) => ({
  job: null,
  isPolling: false,
  error: null,

  reset: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    if (pollTimer) clearTimeout(pollTimer);
    set({ job: null, isPolling: false, error: null });
  },

  cancelPolling: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    if (pollTimer) clearTimeout(pollTimer);
    set({ isPolling: false });
  },

  startImport: async (url: string) => {
    get().cancelPolling();
    set({ error: null, isPolling: true });
    try {
      const job = await api.createPlaylistImport(url);
      set({ job, isPolling: true });
      void get().listenToJob(job.id);
      return job;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start import";
      set({ error: msg, isPolling: false });
      throw err;
    }
  },

  listenToJob: async (jobId: string) => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    if (pollTimer) clearTimeout(pollTimer);

    const controller = new AbortController();
    activeAbortController = controller;
    set({ isPolling: true });

    try {
      for await (const current of api.streamPlaylistImport(jobId, controller.signal)) {
        if (controller.signal.aborted) return;
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
          set({ isPolling: false, job: current, error: current.error?.message ?? "Import failed" });
          return;
        }
      }
    } catch {
      if (controller.signal.aborted) return;
      // If SSE stream disconnected, fallback to safe polling
      void get().pollJob(jobId);
    }
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
        set({ isPolling: false, job: current, error: current.error?.message ?? "Import failed" });
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
