import { contextBridge, ipcRenderer } from "electron";
import type { MainNetResult } from "./netdiag";

export interface DeeplinkTarget {
  type: "artist" | "album" | "playlist" | "track";
  id: string;
}

export interface LinerElectronApi {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  startWindowMove: () => void;
  dragStart: () => void;
  dragMove: (deltaX: number, deltaY: number) => void;
  dragEnd: () => void;
  signRequest: (input: { method: string; path: string; body?: string | null }) => Promise<{
    signature?: string;
    timestamp?: number;
    nonce?: string;
    error?: string;
  }>;
  signMonitorRequest: (input: { method: string; path: string; body?: string | null }) => Promise<{
    signature?: string;
    timestamp?: number;
    nonce?: string;
    error?: string;
  }>;
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
}

const api: LinerElectronApi = {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
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
  signCoverUrl: (payload) => ipcRenderer.invoke("signer:sign-cover-url", payload),
  signRawPayload: (payload) => ipcRenderer.invoke("signer:sign-raw-payload", payload),
  diagnoseNetwork: (hosts) => ipcRenderer.invoke("net:diagnose", hosts),
  openDownloads: (customPath) => ipcRenderer.invoke("shell:open-downloads", customPath),
  openExportFolder: (customPath) => ipcRenderer.invoke("shell:open-export-folder", customPath),
  saveDump: (input) => ipcRenderer.invoke("dialog:save-dump", input),
  onDeeplink: (cb) => {
    const listener = (_event: unknown, target: DeeplinkTarget) => cb(target);
    ipcRenderer.on("deeplink:open", listener);
    return () => {
      ipcRenderer.removeListener("deeplink:open", listener);
    };
  },
};

contextBridge.exposeInMainWorld("linerElectron", api);
