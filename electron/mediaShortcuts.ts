import { globalShortcut, type BrowserWindow } from "electron";
import type { SmtcMediaAction } from "./preload.js";

export type MediaShortcutKey =
  | "MediaPlayPause"
  | "MediaNextTrack"
  | "MediaPreviousTrack"
  | "MediaStop";

export const MEDIA_SHORTCUT_ACTION_MAP: Record<MediaShortcutKey, SmtcMediaAction> = {
  MediaPlayPause: "togglePlay",
  MediaNextTrack: "next",
  MediaPreviousTrack: "prev",
  MediaStop: "stop",
};

export interface GlobalShortcutApi {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
  unregisterAll(): void;
  isRegistered(accelerator: string): boolean;
}

export type GetWindowFn = () => BrowserWindow | null;
export type SendActionFn = (action: SmtcMediaAction) => void;

export interface MediaShortcutsControllerOptions {
  getWindow?: GetWindowFn;
  getMainWindow?: GetWindowFn;
  sendAction?: SendActionFn;
  shortcutApi?: GlobalShortcutApi;
}

export class MediaShortcutsController {
  private readonly registeredKeys = new Set<string>();
  private readonly getWindow?: GetWindowFn;
  private readonly sendActionCallback?: SendActionFn;
  private readonly shortcutApi: GlobalShortcutApi;

  constructor(
    getWindowOrOptions?: GetWindowFn | MediaShortcutsControllerOptions,
    sendAction?: SendActionFn,
    shortcutApi?: GlobalShortcutApi,
  ) {
    if (typeof getWindowOrOptions === "function") {
      this.getWindow = getWindowOrOptions;
      this.sendActionCallback = sendAction;
      this.shortcutApi = shortcutApi ?? globalShortcut;
    } else if (getWindowOrOptions && typeof getWindowOrOptions === "object") {
      this.getWindow = getWindowOrOptions.getWindow ?? getWindowOrOptions.getMainWindow;
      this.sendActionCallback = getWindowOrOptions.sendAction ?? sendAction;
      this.shortcutApi = getWindowOrOptions.shortcutApi ?? shortcutApi ?? globalShortcut;
    } else {
      this.sendActionCallback = sendAction;
      this.shortcutApi = shortcutApi ?? globalShortcut;
    }
  }

  public register(accelerator?: string): boolean {
    if (accelerator === undefined) {
      return this.registerAll();
    }

    if (typeof accelerator === "string") {
      const trimmed = accelerator.trim();
      if (trimmed.length === 0) {
        return false;
      }
      return this.registerKey(trimmed as MediaShortcutKey);
    }

    return false;
  }

  public registerAll(): boolean {
    let allRegistered = true;
    for (const key of Object.keys(MEDIA_SHORTCUT_ACTION_MAP) as MediaShortcutKey[]) {
      const ok = this.registerKey(key);
      if (!ok) {
        allRegistered = false;
      }
    }
    return allRegistered;
  }

  private registerKey(key: MediaShortcutKey): boolean {
    const action = MEDIA_SHORTCUT_ACTION_MAP[key];
    if (!action) return false;

    this.unregister(key);

    try {
      const registered = this.shortcutApi.register(key, () => {
        this.dispatch(action);
      });

      if (registered) {
        this.registeredKeys.add(key);
        return true;
      } else {
        console.warn(`[mediaShortcuts] Registration collision or blocked for: ${key}`);
        return false;
      }
    } catch (err) {
      console.warn(`[mediaShortcuts] Failed to register shortcut ${key}:`, err);
      return false;
    }
  }

  public unregister(accelerator: string): void {
    if (typeof accelerator !== "string") return;
    const trimmed = accelerator.trim();
    if (trimmed.length === 0) return;

    if (this.registeredKeys.has(trimmed)) {
      try {
        this.shortcutApi.unregister(trimmed);
      } catch (err) {
        console.warn(`[mediaShortcuts] Error unregistering ${trimmed}:`, err);
      }
      this.registeredKeys.delete(trimmed);
    }
  }

  public unregisterAll(): void {
    for (const key of Array.from(this.registeredKeys)) {
      try {
        this.shortcutApi.unregister(key);
      } catch (err) {
        console.warn(`[mediaShortcuts] Error unregistering ${key}:`, err);
      }
    }
    this.registeredKeys.clear();
  }

  public isRegistered(accelerator: string): boolean {
    if (typeof accelerator !== "string") return false;
    const trimmed = accelerator.trim();
    if (trimmed.length === 0) return false;
    return this.registeredKeys.has(trimmed);
  }

  public dispatch(action: SmtcMediaAction): void {
    if (this.sendActionCallback) {
      try {
        this.sendActionCallback(action);
      } catch (err) {
        console.error(`[mediaShortcuts] Error in sendAction:`, err);
      }
      return;
    }

    const win = this.getWindow ? this.getWindow() : null;
    if (win && !win.isDestroyed() && !win.webContents?.isDestroyed()) {
      try {
        win.webContents.send("desktop:media-action", action);
      } catch (err) {
        console.error(`[mediaShortcuts] Error sending IPC desktop:media-action:`, err);
      }
    }
  }

  public destroy(): void {
    this.unregisterAll();
  }
}
