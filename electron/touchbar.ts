import { BrowserWindow, ipcMain, globalShortcut, TouchBar, screen } from "electron";
import path from "node:path";

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
  syncedLines?: TouchBarActiveLine[];
  activeIndex?: number;
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
  private nativePlayBtn: any = null;
  private nativeTrackLabel: any = null;
  private nativeLyricsLabel: any = null;

  private wasAutoOpened = false;
  private userDismissedOverlay = false;
  private lastOverlayBounds: { x: number; y: number; width: number; height: number } | null = null;
  private autoShowOnMinimize = true;
  private showTimeline = true;
  private closeOnRestore = true;
  private alwaysOnTop = true;

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
        if (!this.autoShowOnMinimize) return;
        const isPlaying =
          Boolean(this.latestState?.track) &&
          (this.latestState?.status === "playing" ||
            this.latestState?.status === "buffering" ||
            this.latestState?.status === "loading");

        if (!this.userDismissedOverlay && isPlaying) {
          this.wasAutoOpened = true;
          this.mainWindow?.webContents.send("touchbar:request-sync");
          this.showSimulator();
        }
      });

      this.mainWindow.on("restore", () => {
        this.userDismissedOverlay = false;
        if (this.wasAutoOpened && this.closeOnRestore) {
          this.wasAutoOpened = false;
          this.closeSimulator();
        }
      });
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

    ipcMain.handle("touchbar:get-initial-state", () => {
      return this.latestState;
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

    ipcMain.on("touchbar:update-settings", (_event, settings: any) => {
      if (!settings || typeof settings !== "object") return;
      if (typeof settings.autoShowOnMinimize === "boolean") {
        this.autoShowOnMinimize = settings.autoShowOnMinimize;
      }
      if (typeof settings.showTimeline === "boolean") {
        this.showTimeline = settings.showTimeline;
        if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
          const targetHeight = this.showTimeline ? 160 : 126;
          this.simulatorWindow.setMinimumSize(300, targetHeight);
          this.simulatorWindow.setMaximumSize(520, targetHeight);
          const bounds = this.simulatorWindow.getBounds();
          this.simulatorWindow.setBounds({
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: targetHeight,
          });
          this.lastOverlayBounds = { ...bounds, height: targetHeight };
        }
      }
      if (typeof settings.closeOnRestore === "boolean") {
        this.closeOnRestore = settings.closeOnRestore;
      }
      if (typeof settings.alwaysOnTop === "boolean") {
        this.alwaysOnTop = settings.alwaysOnTop;
        if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
          if (process.platform === "darwin") {
            this.simulatorWindow.setAlwaysOnTop(this.alwaysOnTop, "floating");
          } else {
            this.simulatorWindow.setAlwaysOnTop(this.alwaysOnTop);
          }
        }
      }
      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        this.simulatorWindow.webContents.send("touchbar:settings-changed", settings);
      }
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
    const targetHeight = this.showTimeline ? 160 : 126;
    if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
      const bounds = this.simulatorWindow.getBounds();
      if (bounds.height !== targetHeight) {
        this.simulatorWindow.setMinimumSize(300, targetHeight);
        this.simulatorWindow.setMaximumSize(520, targetHeight);
        this.simulatorWindow.setBounds({
          ...bounds,
          height: targetHeight,
        });
        this.lastOverlayBounds = { ...bounds, height: targetHeight };
      }
      this.mainWindow?.webContents.send("touchbar:request-sync");
      if (this.latestState) {
        this.simulatorWindow.webContents.send("touchbar:simulator-state", this.latestState);
      }
      this.simulatorWindow.webContents.send("touchbar:window-shown");
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
    const targetHeight = this.showTimeline ? 160 : 126;
    if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
      if (this.simulatorWindow.isVisible()) {
        this.lastOverlayBounds = { ...this.simulatorWindow.getBounds(), height: targetHeight };
        this.simulatorWindow.hide();
        return false;
      } else {
        const bounds = this.simulatorWindow.getBounds();
        if (bounds.height !== targetHeight) {
          this.simulatorWindow.setMinimumSize(300, targetHeight);
          this.simulatorWindow.setMaximumSize(520, targetHeight);
          this.simulatorWindow.setBounds({
            ...bounds,
            height: targetHeight,
          });
          this.lastOverlayBounds = { ...bounds, height: targetHeight };
        }
        this.mainWindow?.webContents.send("touchbar:request-sync");
        if (this.latestState) {
          this.simulatorWindow.webContents.send("touchbar:simulator-state", this.latestState);
        }
        this.simulatorWindow.webContents.send("touchbar:window-shown");
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
      const targetHeight = this.showTimeline ? 160 : 126;
      this.lastOverlayBounds = { ...this.simulatorWindow.getBounds(), height: targetHeight };
      this.simulatorWindow.hide();
    }
  }

  private createSimulatorWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;
    const defaultWidth = 350;
    const defaultHeight = this.showTimeline ? 160 : 126;
    const width = this.lastOverlayBounds?.width || defaultWidth;
    const height = defaultHeight;
    const x = this.lastOverlayBounds?.x ?? Math.round(workArea.x + workArea.width - width - 20);
    const y = this.lastOverlayBounds?.y ?? Math.round(workArea.y + workArea.height - height - 20);

    this.simulatorWindow = new BrowserWindow({
      title: "Liner Mini Player",
      width,
      height: defaultHeight,
      x,
      y,
      minWidth: 300,
      minHeight: defaultHeight,
      maxWidth: 520,
      maxHeight: defaultHeight,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      show: false,
      alwaysOnTop: this.alwaysOnTop,
      resizable: true,
      skipTaskbar: false,
      hasShadow: false,
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        devTools: true,
        backgroundThrottling: false,
      },
    });

    this.simulatorWindow.once("ready-to-show", () => {
      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        if (this.latestState) {
          this.simulatorWindow.webContents.send("touchbar:simulator-state", this.latestState);
        }
        this.simulatorWindow.webContents.send("touchbar:window-shown");
        this.simulatorWindow.show();
      }
    });

    this.simulatorWindow.on("moved", () => {
      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        const bounds = this.simulatorWindow.getBounds();
        this.lastOverlayBounds = { ...bounds, height: this.showTimeline ? 160 : 126 };
      }
    });

    this.simulatorWindow.on("resized", () => {
      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        const bounds = this.simulatorWindow.getBounds();
        this.lastOverlayBounds = { ...bounds, height: this.showTimeline ? 160 : 126 };
      }
    });

    if (process.platform === "darwin") {
      this.simulatorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.simulatorWindow.setAlwaysOnTop(this.alwaysOnTop, "floating");
    } else {
      this.simulatorWindow.setAlwaysOnTop(this.alwaysOnTop);
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
