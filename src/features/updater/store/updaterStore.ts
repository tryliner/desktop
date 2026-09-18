import { create } from "zustand";
import type { UpdateInfo, UpdateDownloadProgress } from "@/../electron/preload";

export type UpdaterStatus = "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";

export interface UpdaterState {
  status: UpdaterStatus;
  updateInfo: UpdateInfo | null;
  isDialogOpen: boolean;
  downloadProgress: UpdateDownloadProgress | null;
  error: string | null;
  dismissedVersion: string | null;
  isTestMode: boolean;

  // actions
  checkForUpdates: () => Promise<void>;
  skipUpdate: () => void;
  openDialog: () => void;
  startDownload: () => Promise<void>;
  installUpdate: () => Promise<void>;
  triggerTestUpdate: () => void;
  reset: () => void;
  initUpdaterListeners: () => () => void;
}

let testTimer: NodeJS.Timeout | null = null;

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  status: "idle",
  updateInfo: null,
  isDialogOpen: false,
  downloadProgress: null,
  error: null,
  dismissedVersion: null,
  isTestMode: false,

  checkForUpdates: async () => {
    const electron = window.linerElectron;
    if (!electron?.checkForUpdates) return;

    set({ status: "checking", error: null });
    try {
      const res = await electron.checkForUpdates();
      if (res.available && res.version) {
        const info: UpdateInfo = {
          version: res.version,
          releaseNotes: res.releaseNotes,
        };
        const isDismissed = get().dismissedVersion === res.version;
        set({
          status: "available",
          updateInfo: info,
          isDialogOpen: !isDismissed,
          error: null,
          isTestMode: false,
        });
      } else {
        set({ status: "idle", error: res.error || null });
      }
    } catch (err: any) {
      set({ status: "error", error: err?.message || "Failed to check for updates" });
    }
  },

  skipUpdate: () => {
    const version = get().updateInfo?.version ?? null;
    set({ isDialogOpen: false, dismissedVersion: version });
  },

  openDialog: () => {
    if (get().updateInfo) {
      set({ isDialogOpen: true });
    }
  },

  triggerTestUpdate: () => {
    if (testTimer) clearInterval(testTimer);
    set({
      isTestMode: true,
      status: "available",
      updateInfo: {
        version: "9.9.9-test",
        releaseNotes:
          "<b>Test Release v9.9.9</b><br/>Simulated test update for verification of download progress and installation flow.",
      },
      isDialogOpen: true,
      downloadProgress: null,
      error: null,
    });
  },

  startDownload: async () => {
    if (get().isTestMode) {
      set({ isDialogOpen: false, status: "downloading", error: null });
      let currentPercent = 0;
      const totalBytes = 42.5 * 1024 * 1024;
      if (testTimer) clearInterval(testTimer);

      testTimer = setInterval(() => {
        currentPercent += 20;
        if (currentPercent >= 100) {
          if (testTimer) clearInterval(testTimer);
          set({
            status: "downloaded",
            downloadProgress: null,
          });
        } else {
          set({
            downloadProgress: {
              percent: currentPercent,
              transferred: (totalBytes * currentPercent) / 100,
              total: totalBytes,
              bytesPerSecond: 2 * 1024 * 1024,
            },
          });
        }
      }, 500);
      return;
    }

    const electron = window.linerElectron;
    if (!electron?.downloadUpdate) return;

    set({ isDialogOpen: false, status: "downloading", error: null });
    try {
      const res = await electron.downloadUpdate();
      if (!res.success && res.error) {
        set({ status: "error", error: res.error });
      }
    } catch (err: any) {
      set({ status: "error", error: err?.message || "Download failed" });
    }
  },

  installUpdate: async () => {
    const electron = window.linerElectron;
    if (!electron?.quitAndInstall) {
      if (get().isTestMode) {
        get().reset();
      }
      return;
    }
    try {
      await electron.quitAndInstall();
    } catch (err: any) {
      if (get().isTestMode) {
        get().reset();
      } else {
        set({ status: "error", error: err?.message || "Installation failed" });
      }
    }
  },

  reset: () => {
    if (testTimer) clearInterval(testTimer);
    set({
      status: "idle",
      isTestMode: false,
      updateInfo: null,
      isDialogOpen: false,
      downloadProgress: null,
      error: null,
    });
  },

  initUpdaterListeners: () => {
    const electron = window.linerElectron;
    if (!electron) return () => {};

    const unsubAvailable = electron.onUpdateAvailable?.((info) => {
      const isDismissed = get().dismissedVersion === info.version;
      set({
        status: "available",
        updateInfo: info,
        isDialogOpen: !isDismissed,
        error: null,
      });
    });

    const unsubProgress = electron.onUpdateDownloadProgress?.((progress) => {
      set({
        status: "downloading",
        downloadProgress: progress,
      });
    });

    const unsubDownloaded = electron.onUpdateDownloaded?.((info) => {
      set({
        status: "downloaded",
        updateInfo: {
          version: info.version,
          ...(get().updateInfo || {}),
        },
      });
    });

    const unsubError = electron.onUpdateError?.((err) => {
      set({
        status: "error",
        error: err.message,
      });
    });

    return () => {
      unsubAvailable?.();
      unsubProgress?.();
      unsubDownloaded?.();
      unsubError?.();
    };
  },
}));
