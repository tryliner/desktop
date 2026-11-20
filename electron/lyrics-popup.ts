import { BrowserWindow } from "electron";
import path from "node:path";
import { confineToApp, handleTrusted, onTrusted } from "./ipc-guard.js";

const WINDOW_TITLE = "Liner Lyrics";

export class LyricsPopupManager {
  private window: BrowserWindow | null = null;
  private latestState: unknown = null;
  private latestPreferences: unknown = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(
    private readonly preloadPath: string,
    private readonly rendererDist: string,
    private readonly getIndexPath: () => string,
  ) {
    onTrusted("lyrics-popup:update-state", (_event, state: unknown) => {
      this.latestState = state;
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send("lyrics-popup:state", state);
      }
    });
    onTrusted("lyrics-popup:update-clock", (_event, update: unknown) => {
      if (!update || typeof update !== "object") return;
      this.latestState = {
        ...(this.latestState && typeof this.latestState === "object"
          ? this.latestState
          : {}),
        ...(update as Record<string, unknown>),
      };
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send("lyrics-popup:clock", update);
      }
    });
    onTrusted("lyrics-popup:update-preferences", (event, preferences: unknown) => {
      if (!preferences || typeof preferences !== "object") return;
      this.latestPreferences = preferences;
      if (this.window && !this.window.isDestroyed()) {
        this.window.setHasShadow(this.shouldShowWindowShadow());
      }
      if (
        this.window &&
        !this.window.isDestroyed() &&
        this.window.webContents.id !== event.sender.id
      ) {
        this.window.webContents.send("lyrics-popup:preferences", preferences);
      }
    });
    handleTrusted("lyrics-popup:get-state", () => this.latestState);
    handleTrusted("lyrics-popup:get-preferences", () => this.latestPreferences);
    handleTrusted("lyrics-popup:toggle", () => this.toggle());
    onTrusted("lyrics-popup:action", (_event, action: unknown, payload: unknown) => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
      if (
        action === "togglePlay" ||
        action === "next" ||
        action === "prev" ||
        action === "like" ||
        action === "toggleShuffle" ||
        action === "cycleRepeat" ||
        action === "setPlaybackRate" ||
        action === "setPitchSemitones" ||
        action === "setPitchLinked" ||
        action === "setReverbEnabled" ||
        action === "setReverbLevel" ||
        action === "setEqEnabled" ||
        action === "setEqGains"
      ) {
        this.mainWindow.webContents.send("overlay:action", { type: action, payload });
      }
    });
    onTrusted("lyrics-popup:seek", (_event, positionMs: unknown) => {
      if (
        !this.mainWindow ||
        this.mainWindow.isDestroyed() ||
        typeof positionMs !== "number" ||
        !Number.isFinite(positionMs) ||
        positionMs < 0
      ) {
        return;
      }
      this.mainWindow.webContents.send("overlay:action", {
        type: "seek",
        payload: { positionMs },
      });
    });
    onTrusted("lyrics-popup:volume", (_event, volume: unknown) => {
      if (
        !this.mainWindow ||
        this.mainWindow.isDestroyed() ||
        typeof volume !== "number" ||
        !Number.isFinite(volume)
      ) {
        return;
      }
      this.mainWindow.webContents.send("overlay:action", {
        type: "setVolume",
        payload: { volume: Math.min(1, Math.max(0, volume)) },
      });
    });
  }

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  isOpen(): boolean {
    return Boolean(this.window && !this.window.isDestroyed());
  }

  focus() {
    const window = this.window;
    if (!window || window.isDestroyed()) return;
    if (!window.isVisible()) window.show();
    window.focus();
    this.reassertFullscreenPriority(window);
  }

  private shouldShowWindowShadow(): boolean {
    if (!this.latestPreferences || typeof this.latestPreferences !== "object")
      return true;
    const preferences = this.latestPreferences as {
      lyricsOnly?: unknown;
      windowShadow?: unknown;
    };
    return preferences.lyricsOnly !== true && preferences.windowShadow !== false;
  }

  private keepAboveFullscreen(window: BrowserWindow) {
    if (window.isDestroyed()) return;
    try {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {}
    try {
      // Match the main in-game overlay's priority so fullscreen games cannot
      // cover the lyrics window after it receives focus.
      window.setAlwaysOnTop(true, "screen-saver", 1);
    } catch {
      try {
        window.setAlwaysOnTop(true, "floating");
      } catch {
        try {
          window.setAlwaysOnTop(true);
        } catch {}
      }
    }
    try {
      window.moveTop();
    } catch {}
  }

  private reassertFullscreenPriority(window: BrowserWindow) {
    this.keepAboveFullscreen(window);
    // Windows and some compositors can reorder windows during the focus
    // transition; reassert after the OS has completed it as the overlay does.
    setTimeout(() => this.keepAboveFullscreen(window), 100);
  }

  toggle(): boolean {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
      return false;
    }
    const window = new BrowserWindow({
      title: WINDOW_TITLE,
      icon: path.join(process.env.VITE_PUBLIC!, "icon.png"),
      width: 320,
      height: 340,
      minWidth: 300,
      minHeight: 320,
      frame: false,
      resizable: true,
      show: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: this.shouldShowWindowShadow(),
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        backgroundThrottling: false,
      },
    });
    this.window = window;
    confineToApp(window.webContents);
    window.on("focus", () => this.reassertFullscreenPriority(window));
    window.on("restore", () => this.reassertFullscreenPriority(window));
    window.once("ready-to-show", () => {
      if (this.window !== window || window.isDestroyed()) return;
      window.show();
      this.reassertFullscreenPriority(window);
      window.webContents.send("lyrics-popup:shown");
      if (this.latestState) {
        window.webContents.send("lyrics-popup:state", this.latestState);
      }
      if (this.latestPreferences) {
        window.webContents.send(
          "lyrics-popup:preferences",
          this.latestPreferences,
        );
      }
    });
    window.on("closed", () => {
      if (this.window === window) this.window = null;
      const main = this.mainWindow;
      if (main && !main.isDestroyed() && !main.isVisible()) {
        main.show();
        main.focus();
      }
    });
    if (process.env.VITE_DEV_SERVER_URL) {
      void window.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/lyrics-popup`);
    } else {
      void window.loadFile(
        this.getIndexPath() || path.join(this.rendererDist, "index.html"),
        { hash: "/lyrics-popup" },
      );
    }
    return true;
  }

  close() {
    this.window?.close();
    this.window = null;
    this.mainWindow = null;
  }
}
