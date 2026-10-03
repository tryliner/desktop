import { app, BrowserWindow, ipcMain, globalShortcut, TouchBar } from "electron";
import path from "node:path";

export interface TouchBarTrackInfo {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string | null;
  durationMs?: number;
}

export interface TouchBarStatePayload {
  status: "playing" | "paused" | "loading" | "buffering" | "idle";
  track: TouchBarTrackInfo | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  isLiked: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  activeLyricText?: string;
  nextLyricText?: string;
  offsetMs?: number;
  currentRoute?: string;
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
    | "toggleShuffle";
  payload?: any;
}

export class TouchBarManager {
  private mainWindow: BrowserWindow | null = null;
  private simulatorWindow: BrowserWindow | null = null;
  private latestState: TouchBarStatePayload | null = null;
  private preloadPath: string;
  private rendererDist: string;
  private nativeTouchBar: any = null;
  private nativePlayBtn: any = null;
  private nativeTrackLabel: any = null;
  private nativeLyricsLabel: any = null;

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
    const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar;

    this.nativePlayBtn = new TouchBarButton({
      label: "▶",
      click: () => {
        this.forwardAction({ type: "togglePlay" });
      },
    });

    const prevBtn = new TouchBarButton({
      label: "⏮",
      click: () => {
        this.forwardAction({ type: "prev" });
      },
    });

    const nextBtn = new TouchBarButton({
      label: "⏭",
      click: () => {
        this.forwardAction({ type: "next" });
      },
    });

    this.nativeTrackLabel = new TouchBarLabel({
      label: "Liner",
    });

    this.nativeLyricsLabel = new TouchBarLabel({
      label: "",
    });

    this.nativeTouchBar = new TouchBar({
      items: [
        this.nativeTrackLabel,
        new TouchBarSpacer({ size: "small" }),
        prevBtn,
        this.nativePlayBtn,
        nextBtn,
        new TouchBarSpacer({ size: "flexible" }),
        this.nativeLyricsLabel,
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

      if (process.platform === "darwin" && this.nativeTouchBar) {
        if (this.nativePlayBtn) {
          this.nativePlayBtn.label = state.status === "playing" ? "⏸" : "▶";
        }
        if (this.nativeTrackLabel) {
          this.nativeTrackLabel.label = state.track
            ? `${state.track.title} - ${state.track.artist}`
            : "Liner";
        }
        if (this.nativeLyricsLabel) {
          this.nativeLyricsLabel.label = state.activeLyricText || "";
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
