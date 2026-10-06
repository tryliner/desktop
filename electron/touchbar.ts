import { BrowserWindow, ipcMain, TouchBar } from "electron";

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
    | "restoreMainWindow";
  payload?: any;
}

export class TouchBarManager {
  private mainWindow: BrowserWindow | null = null;
  private latestState: TouchBarStatePayload | null = null;

  private nativeTouchBar: any = null;
  private nativePlayBtn: any = null;
  private nativeTrackLabel: any = null;
  private nativeLyricsLabel: any = null;

  constructor(_preloadPath?: string, _rendererDist?: string) {
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
        return;
      }
      this.forwardAction(action);
    });

    ipcMain.handle("touchbar:get-initial-state", () => {
      return this.latestState;
    });

    ipcMain.handle("touchbar:toggle-simulator", () => {
      return false;
    });

    ipcMain.handle("touchbar:is-simulator-open", () => {
      return false;
    });

    ipcMain.on("touchbar:close-simulator", () => {});
    ipcMain.on("touchbar:update-settings", () => {});
  }

  public registerShortcut() {
    // Simulator shortcuts removed
  }

  public unregisterShortcut() {
    // Simulator shortcuts removed
  }

  private forwardAction(action: TouchBarAction) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("touchbar:action", action);
    }
  }
}
