import { BrowserWindow, ipcMain, globalShortcut, TouchBar } from "electron";
import path from "node:path";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export interface TouchBarTrackInfo {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string | null;
  durationMs?: number;
}

export interface TouchBarActiveLine {
  text: string;
  timeMs: number;
  durationMs?: number;
  isInstrumental?: boolean;
}

export interface TouchBarStatePayload {
  status: "playing" | "paused" | "loading" | "buffering" | "idle" | "error";
  track: TouchBarTrackInfo | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  isLiked: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  activeLine?: TouchBarActiveLine | null;
  activeLyricText?: string;
  nextLyricText?: string;
  offsetMs?: number;
  currentRoute?: string;
  isFullscreen?: boolean;
  hasSyncedLyrics?: boolean;
}

export interface TouchBarAction {
  type:
    | "togglePlay"
    | "play"
    | "pause"
    | "next"
    | "prev"
    | "seek"
    | "like"
    | "volume"
    | "adjustOffset"
    | "navigate"
    | "toggleShuffle"
    | "toggleFullscreen";
  payload?: any;
}

export class TouchBarManager {
  private mainWindow: BrowserWindow | null = null;
  private simulatorWindow: BrowserWindow | null = null;
  private latestState: TouchBarStatePayload | null = null;
  private preloadPath: string;
  private rendererDist: string;

  private nativeTouchBar: any = null;
  private currentTimeLabel: any = null;
  private durationTimeLabel: any = null;
  private nativeTimelineSlider: any = null;

  private isUserSeeking = false;
  private seekDebounceTimer: any = null;

  constructor(preloadPath: string, rendererDist: string) {
    this.preloadPath = preloadPath;
    this.rendererDist = rendererDist;
    this.registerIpcHandlers();
  }

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
    if (this.mainWindow && process.platform === "darwin") {
      this.initNativeTouchBar();
    }
  }

  private initNativeTouchBar() {
    if (!TouchBar) return;
    const { TouchBarLabel, TouchBarSpacer, TouchBarSlider } = TouchBar;

    this.currentTimeLabel = new TouchBarLabel({
      label: "0:00",
      textColor: "#8e8e93",
    });

    this.nativeTimelineSlider = new TouchBarSlider({
      minValue: 0,
      maxValue: 100,
      value: 0,
      change: (val: number) => {
        this.isUserSeeking = true;
        if (this.currentTimeLabel) {
          this.currentTimeLabel.label = formatTime(val * 1000);
        }
        this.forwardAction({ type: "seek", payload: { positionMs: val * 1000 } });
        if (this.seekDebounceTimer) clearTimeout(this.seekDebounceTimer);
        this.seekDebounceTimer = setTimeout(() => {
          this.isUserSeeking = false;
        }, 400);
      },
    });

    this.durationTimeLabel = new TouchBarLabel({
      label: "0:00",
      textColor: "#8e8e93",
    });

    this.nativeTouchBar = new TouchBar({
      items: [
        new TouchBarSpacer({ size: "small" }),
        this.currentTimeLabel,
        new TouchBarSpacer({ size: "small" }),
        this.nativeTimelineSlider,
        new TouchBarSpacer({ size: "small" }),
        this.durationTimeLabel,
        new TouchBarSpacer({ size: "small" }),
      ],
    });

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setTouchBar(this.nativeTouchBar);
    }
  }

  private registerIpcHandlers() {
    ipcMain.on("touchbar:update-state", (_event, state: TouchBarStatePayload) => {
      this.latestState = state;

      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        this.simulatorWindow.webContents.send("touchbar:simulator-state", state);
      }

      if (process.platform === "darwin") {
        const durationMs = Math.max(0, state.durationMs || 0);
        const positionMs = Math.max(0, Math.min(durationMs, state.positionMs || 0));

        if (this.currentTimeLabel && !this.isUserSeeking) {
          this.currentTimeLabel.label = formatTime(positionMs);
        }

        if (this.durationTimeLabel) {
          this.durationTimeLabel.label = formatTime(durationMs);
        }

        if (this.nativeTimelineSlider) {
          const totalSec = Math.max(1, Math.floor(durationMs / 1000));
          const currentSec = Math.min(totalSec, Math.floor(positionMs / 1000));
          this.nativeTimelineSlider.maxValue = totalSec;
          if (!this.isUserSeeking) {
            this.nativeTimelineSlider.value = currentSec;
          }
        }
      }
    });

    ipcMain.on("touchbar:send-action", (_event, action: TouchBarAction) => {
      this.forwardAction(action);
    });

    ipcMain.handle("touchbar:toggle-simulator", () => {
      return this.toggleSimulator();
    });

    ipcMain.handle("touchbar:is-simulator-open", () => {
      return Boolean(this.simulatorWindow && !this.simulatorWindow.isDestroyed());
    });

    ipcMain.on("touchbar:close-simulator", () => {
      this.closeSimulator();
    });
  }

  public registerShortcut() {
    try {
      globalShortcut.register("CommandOrControl+Alt+T", () => {
        this.toggleSimulator();
      });
    } catch {}
  }

  public unregisterShortcut() {
    try {
      globalShortcut.unregister("CommandOrControl+Alt+T");
    } catch {}
  }

  public toggleSimulator(): boolean {
    if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
      if (this.simulatorWindow.isVisible()) {
        this.simulatorWindow.hide();
        return false;
      } else {
        this.simulatorWindow.show();
        this.simulatorWindow.focus();
        return true;
      }
    }

    this.createSimulatorWindow();
    return true;
  }

  public closeSimulator() {
    if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
      this.simulatorWindow.close();
      this.simulatorWindow = null;
    }
  }

  private createSimulatorWindow() {
    this.simulatorWindow = new BrowserWindow({
      title: "Liner Touch Bar",
      width: 960,
      height: 48,
      minWidth: 600,
      minHeight: 44,
      maxHeight: 52,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: false,
      hasShadow: false,
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        devTools: true,
      },
    });

    const targetUrl = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL}#/touchbar-simulator`
      : `file://${path.join(this.rendererDist, "index.html")}#/touchbar-simulator`;

    this.simulatorWindow.loadURL(targetUrl);

    this.simulatorWindow.webContents.on("did-finish-load", () => {
      if (this.latestState && this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        this.simulatorWindow.webContents.send("touchbar:simulator-state", this.latestState);
      }
    });

    this.simulatorWindow.on("closed", () => {
      this.simulatorWindow = null;
    });
  }

  private forwardAction(action: TouchBarAction) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("touchbar:action", action);
    }
  }
}
