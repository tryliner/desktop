import { BrowserWindow, ipcMain, globalShortcut, TouchBar, screen } from "electron";
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
    | "toggleFullscreen"
    | "restoreMainWindow"
    | "closeOverlay";
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
  private wasAutoOpened = false;
  private userDismissedOverlay = false;
  private lastOverlayBounds: { x: number; y: number; width: number; height: number } | null = null;

  constructor(preloadPath: string, rendererDist: string) {
    this.preloadPath = preloadPath;
    this.rendererDist = rendererDist;
    this.registerIpcHandlers();
  }

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
    if (this.mainWindow) {
      if (process.platform === "darwin") {
        this.initNativeTouchBar();
      }

      this.mainWindow.on("minimize", () => {
        if (!this.userDismissedOverlay && this.latestState?.track) {
          this.wasAutoOpened = true;
          this.showSimulator();
        }
      });

      this.mainWindow.on("restore", () => {
        this.userDismissedOverlay = false;
        if (this.wasAutoOpened) {
          this.wasAutoOpened = false;
          this.closeSimulator();
        }
      });
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
      if (action.type === "restoreMainWindow") {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.show();
          this.mainWindow.focus();
        }
        if (this.wasAutoOpened) {
          this.wasAutoOpened = false;
          this.closeSimulator();
        }
        return;
      }
      if (action.type === "closeOverlay") {
        this.userDismissedOverlay = true;
        this.wasAutoOpened = false;
        this.closeSimulator();
        return;
      }
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
      globalShortcut.register("CommandOrControl+Shift+M", () => {
        this.toggleSimulator();
      });
      globalShortcut.register("CommandOrControl+Alt+T", () => {
        this.toggleSimulator();
      });
    } catch {}
  }

  public unregisterShortcut() {
    try {
      globalShortcut.unregister("CommandOrControl+Shift+M");
      globalShortcut.unregister("CommandOrControl+Alt+T");
    } catch {}
  }

  public showSimulator() {
    if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
      if (this.lastOverlayBounds) {
        this.simulatorWindow.setBounds(this.lastOverlayBounds);
      }
      if (!this.simulatorWindow.isVisible()) {
        this.simulatorWindow.show();
      }
      return;
    }
    this.createSimulatorWindow();
  }

  public toggleSimulator(): boolean {
    this.userDismissedOverlay = false;
    this.wasAutoOpened = false;
    if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
      if (this.simulatorWindow.isVisible()) {
        this.lastOverlayBounds = this.simulatorWindow.getBounds();
        this.simulatorWindow.hide();
        return false;
      } else {
        if (this.lastOverlayBounds) {
          this.simulatorWindow.setBounds(this.lastOverlayBounds);
        }
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
      this.lastOverlayBounds = this.simulatorWindow.getBounds();
      this.simulatorWindow.hide();
    }
  }

  private createSimulatorWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;
    const defaultWidth = 350;
    const defaultHeight = 188;
    const width = this.lastOverlayBounds?.width || defaultWidth;
    const height = Math.max(188, this.lastOverlayBounds?.height || defaultHeight);
    const x = this.lastOverlayBounds?.x ?? Math.round(workArea.x + workArea.width - width - 20);
    const y = this.lastOverlayBounds?.y ?? Math.round(workArea.y + workArea.height - height - 20);

    this.simulatorWindow = new BrowserWindow({
      title: "Liner Mini Player",
      width,
      height,
      x,
      y,
      minWidth: 300,
      minHeight: 175,
      maxWidth: 480,
      maxHeight: 260,
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

    this.simulatorWindow.on("moved", () => {
      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        this.lastOverlayBounds = this.simulatorWindow.getBounds();
      }
    });

    this.simulatorWindow.on("resized", () => {
      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        this.lastOverlayBounds = this.simulatorWindow.getBounds();
      }
    });

    if (process.platform === "darwin") {
      this.simulatorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.simulatorWindow.setAlwaysOnTop(true, "floating");
    }

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
