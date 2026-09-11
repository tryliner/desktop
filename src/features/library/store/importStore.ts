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
  pendingTrack: null,

  reset: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    if (pollTimer) clearTimeout(pollTimer);
    set({ job: null, isPolling: false, error: null, pendingTrack: null });
  },

  cancelPolling: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    if (pollTimer) clearTimeout(pollTimer);
    set({ isPolling: false });
  },

  startImport: async (url: string, pendingTrack: TrackDetail | null = null) => {
    get().cancelPolling();
    set({ error: null, isPolling: true, pendingTrack });
    try {
      const job = await api.createPlaylistImport(url);
      set({ job, isPolling: true });
      void get().listenToJob(job.id);
      return job;
    } catch (err) {
      // store stays generic, callers map the raw error to a friendly message
      set({ error: "Failed to start import", isPolling: false, pendingTrack: null });
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
          set({ isPolling: false, job: current, error: "Import failed" });
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
      showToast(translate("common.added_to_playlist"), "success");
    } catch {
      showToast(translate("common.failed_add_playlist"), "error");
    }
  })();
});
