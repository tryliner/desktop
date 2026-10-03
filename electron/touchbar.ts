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

  private standardTouchBar: any = null;
  private lyricsTouchBar: any = null;
  private currentTouchBarMode: "standard" | "lyrics" = "standard";

  private stdPlayBtn: any = null;
  private stdShuffleBtn: any = null;
  private stdLikeBtn: any = null;
  private stdFullscreenBtn: any = null;
  private nativeTimeLabel: any = null;
  private nativeTimelineSlider: any = null;

  private lyrPlayBtn: any = null;
  private lyrShuffleBtn: any = null;
  private lyrLikeBtn: any = null;
  private lyrFullscreenBtn: any = null;
  private nativeLyricsLabel: any = null;
  private nativeNextLyricsLabel: any = null;

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
    const { TouchBarButton, TouchBarLabel, TouchBarSpacer, TouchBarSlider } = TouchBar;

    this.stdShuffleBtn = new TouchBarButton({
      label: "🔀",
      click: () => {
        this.forwardAction({ type: "toggleShuffle" });
      },
    });

    const stdPrevBtn = new TouchBarButton({
      label: "⏮",
      click: () => {
        this.forwardAction({ type: "prev" });
      },
    });

    this.stdPlayBtn = new TouchBarButton({
      label: "▶",
      click: () => {
        this.forwardAction({ type: "togglePlay" });
      },
    });

    const stdNextBtn = new TouchBarButton({
      label: "⏭",
      click: () => {
        this.forwardAction({ type: "next" });
      },
    });

    this.nativeTimeLabel = new TouchBarLabel({
      label: "0:00 / 0:00",
    });

    this.nativeTimelineSlider = new TouchBarSlider({
      minValue: 0,
      maxValue: 100,
      value: 0,
      change: (val: number) => {
        this.isUserSeeking = true;
        this.forwardAction({ type: "seek", payload: { positionMs: val * 1000 } });
        if (this.seekDebounceTimer) clearTimeout(this.seekDebounceTimer);
        this.seekDebounceTimer = setTimeout(() => {
          this.isUserSeeking = false;
        }, 300);
      },
    });

    this.stdLikeBtn = new TouchBarButton({
      label: "♡",
      click: () => {
        this.forwardAction({ type: "like" });
      },
    });

    this.stdFullscreenBtn = new TouchBarButton({
      label: "⤢",
      click: () => {
        this.forwardAction({ type: "toggleFullscreen" });
      },
    });

    this.standardTouchBar = new TouchBar({
      items: [
        this.stdShuffleBtn,
        stdPrevBtn,
        this.stdPlayBtn,
        stdNextBtn,
        new TouchBarSpacer({ size: "small" }),
        this.nativeTimeLabel,
        this.nativeTimelineSlider,
        new TouchBarSpacer({ size: "small" }),
        this.stdLikeBtn,
        this.stdFullscreenBtn,
      ],
    });

    this.lyrShuffleBtn = new TouchBarButton({
      label: "🔀",
      click: () => {
        this.forwardAction({ type: "toggleShuffle" });
      },
    });

    const lyrPrevBtn = new TouchBarButton({
      label: "⏮",
      click: () => {
        this.forwardAction({ type: "prev" });
      },
    });

    this.lyrPlayBtn = new TouchBarButton({
      label: "▶",
      click: () => {
        this.forwardAction({ type: "togglePlay" });
      },
    });

    const lyrNextBtn = new TouchBarButton({
      label: "⏭",
      click: () => {
        this.forwardAction({ type: "next" });
      },
    });

    this.nativeLyricsLabel = new TouchBarLabel({
      label: "•••",
      textColor: "#ffffff",
    });

    this.nativeNextLyricsLabel = new TouchBarLabel({
      label: "",
      textColor: "#8e8e93",
    });

    this.lyrLikeBtn = new TouchBarButton({
      label: "♡",
      click: () => {
        this.forwardAction({ type: "like" });
      },
    });

    this.lyrFullscreenBtn = new TouchBarButton({
      label: "⌄",
      click: () => {
        this.forwardAction({ type: "toggleFullscreen" });
      },
    });

    this.lyricsTouchBar = new TouchBar({
      items: [
        this.lyrShuffleBtn,
        lyrPrevBtn,
        this.lyrPlayBtn,
        lyrNextBtn,
        new TouchBarSpacer({ size: "small" }),
        this.nativeLyricsLabel,
        new TouchBarSpacer({ size: "flexible" }),
        this.nativeNextLyricsLabel,
        new TouchBarSpacer({ size: "small" }),
        this.lyrLikeBtn,
        this.lyrFullscreenBtn,
      ],
    });

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.currentTouchBarMode = "standard";
      this.mainWindow.setTouchBar(this.standardTouchBar);
    }
  }

  private registerIpcHandlers() {
    ipcMain.on("touchbar:update-state", (_event, state: TouchBarStatePayload) => {
      this.latestState = state;

      if (this.simulatorWindow && !this.simulatorWindow.isDestroyed()) {
        this.simulatorWindow.webContents.send("touchbar:simulator-state", state);
      }

      if (process.platform === "darwin") {
        const isPlaying = state.status === "playing";
        const playLabel = isPlaying ? "⏸" : "▶";
        if (this.stdPlayBtn) this.stdPlayBtn.label = playLabel;
        if (this.lyrPlayBtn) this.lyrPlayBtn.label = playLabel;

        const shuffleBg = state.shuffle ? "#3a3a3c" : undefined;
        if (this.stdShuffleBtn) this.stdShuffleBtn.backgroundColor = shuffleBg;
        if (this.lyrShuffleBtn) this.lyrShuffleBtn.backgroundColor = shuffleBg;

        const likeLabel = state.isLiked ? "❤️" : "♡";
        if (this.stdLikeBtn) this.stdLikeBtn.label = likeLabel;
        if (this.lyrLikeBtn) this.lyrLikeBtn.label = likeLabel;

        const fsLabel = state.isFullscreen ? "⌄" : "⤢";
        if (this.stdFullscreenBtn) this.stdFullscreenBtn.label = fsLabel;
        if (this.lyrFullscreenBtn) this.lyrFullscreenBtn.label = fsLabel;

        if (this.nativeTimeLabel) {
          this.nativeTimeLabel.label = `${formatTime(state.positionMs)} / ${formatTime(state.durationMs)}`;
        }

        if (this.nativeTimelineSlider) {
          const totalSec = Math.max(1, Math.floor(state.durationMs / 1000));
          const currentSec = Math.min(totalSec, Math.floor(state.positionMs / 1000));
          this.nativeTimelineSlider.maxValue = totalSec;
          if (!this.isUserSeeking) {
            this.nativeTimelineSlider.value = currentSec;
          }
        }

        if (this.nativeLyricsLabel) {
          if (state.activeLine?.isInstrumental) {
            this.nativeLyricsLabel.label = "♪ Instrumental";
          } else {
            this.nativeLyricsLabel.label = state.activeLyricText || "•••";
          }
        }

        if (this.nativeNextLyricsLabel) {
          this.nativeNextLyricsLabel.label = state.nextLyricText ? `  ${state.nextLyricText}` : "";
        }

        const shouldShowLyricsMode = Boolean(state.isFullscreen && state.hasSyncedLyrics);
        const desiredMode = shouldShowLyricsMode ? "lyrics" : "standard";

        if (desiredMode !== this.currentTouchBarMode && this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.currentTouchBarMode = desiredMode;
          const bar = desiredMode === "lyrics" ? this.lyricsTouchBar : this.standardTouchBar;
          if (bar) {
            this.mainWindow.setTouchBar(bar);
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
