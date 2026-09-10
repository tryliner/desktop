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
  dragMove: (deltaX: number, deltaY: number) => void;
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
}

const api: LinerElectronApi = {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  dragMove: (deltaX: number, deltaY: number) => {
    ipcRenderer.send("window:drag-move", { deltaX, deltaY });
  },
  signRequest: (input) => ipcRenderer.invoke("signer:sign-request", input),
  signMonitorRequest: (input) => ipcRenderer.invoke("signer:sign-monitor-request", input),
  signCoverUrl: (payload) => ipcRenderer.invoke("signer:sign-cover-url", payload),
  signRawPayload: (payload) => ipcRenderer.invoke("signer:sign-raw-payload", payload),
  diagnoseNetwork: (hosts) => ipcRenderer.invoke("net:diagnose", hosts),
  onDeeplink: (cb) => {
    const listener = (_event: unknown, target: DeeplinkTarget) => cb(target);
    ipcRenderer.on("deeplink:open", listener);
    return () => {
      ipcRenderer.removeListener("deeplink:open", listener);
    };
  },
};

contextBridge.exposeInMainWorld("linerElectron", api);
