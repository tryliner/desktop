import { contextBridge, ipcRenderer } from "electron";
import type { MainNetResult } from "./netdiag";

export interface DeeplinkTarget {
  type: "artist" | "album" | "playlist" | "track";
  id: string;
}

export interface ElectronCacheStats {
  cacheSize: number;
  httpCacheSize: number;
  codeCacheSize: number;
  serviceWorkerSize: number;
  indexedDbSize: number;
  localStorageSize: number;
  blobStorageSize: number;
  cachePath: string;
}

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface WindowState {
  isMaximized: boolean;
  isFullScreen: boolean;
}

export interface LinerElectronApi {
  platform: string;
  isHyprland: boolean;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  toggleFullScreen: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  isFullScreen: () => Promise<boolean>;
  onWindowStateChange: (cb: (state: WindowState) => void) => () => void;
  startWindowMove: () => void;
  dragStart: () => void;
  dragMove: (deltaX: number, deltaY: number) => void;
  dragEnd: () => void;
  signRequest: (input: { method: string; path: string; body?: string | null; timestamp?: number }) => Promise<{
    signature?: string;
    timestamp?: number;
    nonce?: string;
    error?: string;
  }>;
  signMonitorRequest: (input: { method: string; path: string; body?: string | null; timestamp?: number }) => Promise<{
    signature?: string;
    timestamp?: number;
    nonce?: string;
    error?: string;
  }>;
  syncServerTime: (dateHeaderOrMs: string | number) => Promise<number>;
  getServerTimeOffset: () => Promise<number>;
  signCoverUrl: (payload: string) => Promise<string>;
  signRawPayload: (payload: number[] | Uint8Array) => Promise<string>;
  onDeeplink: (cb: (target: DeeplinkTarget) => void) => () => void;
  diagnoseNetwork: (hosts: string[]) => Promise<MainNetResult>;
  openDownloads: (customPath?: string) => Promise<boolean>;
  openExportFolder: (customPath?: string) => Promise<boolean>;
  saveDump: (input: { filename: string; content: string }) => Promise<{
    success: boolean;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }>;
  setAppIcon: (dataUrl: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  getCacheStats: () => Promise<ElectronCacheStats>;
  openCacheFolder: () => Promise<boolean>;
  clearCoversCache: () => Promise<boolean>;
  clearAudioCache: () => Promise<boolean>;
  clearHttpCache: () => Promise<boolean>;
  checkForUpdates: () => Promise<{ available: boolean; version?: string; releaseNotes?: string; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstall: () => Promise<boolean>;
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => () => void;
  onUpdateDownloadProgress: (cb: (progress: UpdateDownloadProgress) => void) => () => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void;
  onUpdateError: (cb: (err: { message: string }) => void) => () => void;
}

const isHyprland = Boolean(
  process.env.HYPRLAND_INSTANCE_SIGNATURE ||
  process.env.XDG_CURRENT_DESKTOP?.toLowerCase().includes("hyprland") ||
  process.env.XDG_SESSION_DESKTOP?.toLowerCase().includes("hyprland"),
);

const api: LinerElectronApi = {
  platform: process.platform,
  isHyprland,
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  toggleFullScreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  isFullScreen: () => ipcRenderer.invoke("window:is-fullscreen"),
  onWindowStateChange: (cb) => {
    const listener = (_event: unknown, state: WindowState) => cb(state);
    ipcRenderer.on("window:state-changed", listener);
    return () => {
      ipcRenderer.removeListener("window:state-changed", listener);
    };
  },
  startWindowMove: () => {
    ipcRenderer.send("window:start-drag");
  },
  dragStart: () => {
    ipcRenderer.send("window:drag-start");
  },
  dragMove: (deltaX: number, deltaY: number) => {
    ipcRenderer.send("window:drag-move", { deltaX, deltaY });
  },
  dragEnd: () => {
    ipcRenderer.send("window:drag-end");
  },
  signRequest: (input) => ipcRenderer.invoke("signer:sign-request", input),
  signMonitorRequest: (input) => ipcRenderer.invoke("signer:sign-monitor-request", input),
  syncServerTime: (dateHeaderOrMs) => ipcRenderer.invoke("signer:sync-time", dateHeaderOrMs),
  getServerTimeOffset: () => ipcRenderer.invoke("signer:get-time-offset"),
  signCoverUrl: (payload) => ipcRenderer.invoke("signer:sign-cover-url", payload),
  signRawPayload: (payload) => ipcRenderer.invoke("signer:sign-raw-payload", payload),
  diagnoseNetwork: (hosts) => ipcRenderer.invoke("net:diagnose", hosts),
  openDownloads: (customPath) => ipcRenderer.invoke("shell:open-downloads", customPath),
  openExportFolder: (customPath) => ipcRenderer.invoke("shell:open-export-folder", customPath),
  saveDump: (input) => ipcRenderer.invoke("dialog:save-dump", input),
  setAppIcon: (dataUrl) => ipcRenderer.invoke("app:set-icon", dataUrl),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getCacheStats: () => ipcRenderer.invoke("storage:get-cache-stats"),
  openCacheFolder: () => ipcRenderer.invoke("shell:open-cache-folder"),
  clearCoversCache: () => ipcRenderer.invoke("storage:clear-covers-cache"),
  clearAudioCache: () => ipcRenderer.invoke("storage:clear-audio-cache"),
  clearHttpCache: () => ipcRenderer.invoke("storage:clear-http-cache"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download-update"),
  quitAndInstall: () => ipcRenderer.invoke("updater:quit-and-install"),
  onUpdateAvailable: (cb) => {
    const listener = (_event: unknown, info: UpdateInfo) => cb(info);
    ipcRenderer.on("updater:update-available", listener);
    return () => {
      ipcRenderer.removeListener("updater:update-available", listener);
    };
  },
  onUpdateDownloadProgress: (cb) => {
    const listener = (_event: unknown, progress: UpdateDownloadProgress) => cb(progress);
    ipcRenderer.on("updater:download-progress", listener);
    return () => {
      ipcRenderer.removeListener("updater:download-progress", listener);
    };
  },
  onUpdateDownloaded: (cb) => {
    const listener = (_event: unknown, info: { version: string }) => cb(info);
    ipcRenderer.on("updater:update-downloaded", listener);
    return () => {
      ipcRenderer.removeListener("updater:update-downloaded", listener);
    };
  },
  onUpdateError: (cb) => {
    const listener = (_event: unknown, err: { message: string }) => cb(err);
    ipcRenderer.on("updater:error", listener);
    return () => {
      ipcRenderer.removeListener("updater:error", listener);
    };
  },
  onDeeplink: (cb) => {
    const listener = (_event: unknown, target: DeeplinkTarget) => cb(target);
    ipcRenderer.on("deeplink:open", listener);
    return () => {
      ipcRenderer.removeListener("deeplink:open", listener);
    };
  },
};

contextBridge.exposeInMainWorld("linerElectron", api);
