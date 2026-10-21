import { BrowserWindow, ipcMain, screen, globalShortcut, app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { shouldShowOnBackground } from "./overlay-autoshow";

export type OverlayPosition = "top-left" | "top-center" | "top-right";

export interface OverlaySettings {
  enabled: boolean;
  position: OverlayPosition;
  shortcut: string;
  likeShortcut?: string;
  autoShowOnMinimize: boolean;
  alwaysOnTop: boolean;
}

const CYRILLIC_TO_QWERTY: Record<string, string> = {
  "й": "Q", "ц": "W", "у": "E", "к": "R", "е": "T", "н": "Y", "г": "U", "ш": "I", "щ": "O", "з": "P", "х": "[", "ъ": "]",
  "ф": "A", "ы": "S", "в": "D", "а": "F", "п": "G", "р": "H", "о": "J", "л": "K", "д": "L", "ж": ";", "э": "'",
  "я": "Z", "ч": "X", "с": "C", "м": "V", "и": "B", "т": "N", "ь": "M", "б": ",", "ю": ".", "ё": "`",
  "і": "S", "ї": "]", "є": "'", "ґ": "\\",
};

function normalizeShortcut(raw: string): string {
  if (!raw) return "";
  const parts = raw.split("+").map((p) => p.trim()).filter(Boolean);
  const normalized: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "control" || lower === "ctrl" || lower === "commandorcontrol") {
      normalized.push("Control");
    } else if (lower === "alt" || lower === "option") {
      normalized.push("Alt");
    } else if (lower === "shift") {
      normalized.push("Shift");
    } else if (lower === "command" || lower === "cmd" || lower === "meta") {
      normalized.push("Command");
    } else if (CYRILLIC_TO_QWERTY[lower]) {
      normalized.push(CYRILLIC_TO_QWERTY[lower]);
    } else if (lower === "space") {
      normalized.push("Space");
    } else if (lower === "plus" || lower === "+") {
      normalized.push("Plus");
    } else {
      normalized.push(part.toUpperCase());
    }
  }
  return normalized.join("+");
}

export class OverlayManager {
  private mainWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private latestState: any = null;
  private preloadPath: string;
  private rendererDist: string;

  private enabled = true;
  private position: OverlayPosition = "top-center";
  private shortcut = "Alt+Shift+O";
  private likeShortcut = "Alt+Shift+L";
  private shortcutsPaused = false;
  private currentRegisteredShortcut: string | null = null;
  private currentRegisteredLikeShortcut: string | null = null;
  private autoShowOnMinimize = true;
  private alwaysOnTop = true;
  private wasAutoOpened = false;
  private isAuthenticated = false;
  // set once the app is quitting: nothing may create a window or grab a shortcut again
  private disposed = false;

  private moveAnimationTimer: NodeJS.Timeout | null = null;
  private currentAnimatedX: number | null = null;
  private closeTimeout: NodeJS.Timeout | null = null;
  private blurTimeout: NodeJS.Timeout | null = null;

  constructor(preloadPath: string, rendererDist: string) {
    this.preloadPath = preloadPath;
    this.rendererDist = rendererDist;
    this.loadPersistedSettings();
    this.registerIpcHandlers();
  }

  private getSettingsFilePath(): string {
    try {
      return path.join(app.getPath("userData"), "overlay-settings.json");
    } catch {
      return "";
    }
  }

  private loadPersistedSettings() {
    try {
      const filePath = this.getSettingsFilePath();
      if (filePath && fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw);
        if (typeof data.enabled === "boolean") this.enabled = data.enabled;
        if (
          data.position === "top-left" ||
          data.position === "top-center" ||
          data.position === "top-right"
        ) {
          this.position = data.position;
        }
        if (typeof data.shortcut === "string" && data.shortcut.trim()) {
          this.shortcut = data.shortcut.trim();
        }
        if (typeof data.likeShortcut === "string" && data.likeShortcut.trim()) {
          this.likeShortcut = data.likeShortcut.trim();
        }
        if (typeof data.autoShowOnMinimize === "boolean") {
          this.autoShowOnMinimize = data.autoShowOnMinimize;
        }
        if (typeof data.alwaysOnTop === "boolean") {
          this.alwaysOnTop = data.alwaysOnTop;
        }
      }
    } catch (e) {
      console.warn("[overlay] Could not read overlay-settings.json:", e);
    }
  }

  private savePersistedSettings() {
    try {
      const filePath = this.getSettingsFilePath();
      if (!filePath) return;
      const data: OverlaySettings = {
        enabled: this.enabled,
        position: this.position,
        shortcut: this.shortcut,
        likeShortcut: this.likeShortcut,
        autoShowOnMinimize: this.autoShowOnMinimize,
        alwaysOnTop: this.alwaysOnTop,
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn("[overlay] Could not write overlay-settings.json:", e);
    }
  }

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
    if (this.mainWindow) {
      this.mainWindow.on("minimize", () => {
        if (!this.isAuthenticated || !this.enabled || !this.autoShowOnMinimize) return;
        this.wasAutoOpened = true;
        // Small delay so the OS completes window minimization and activates
        // the underlying window (e.g. fullscreen browser) before overlay displays and elevates
        setTimeout(() => {
          if (!this.isAuthenticated) return;
          this.showOverlay();
        }, 50);
      });

      this.mainWindow.on("restore", () => {
        if (this.wasAutoOpened) {
          this.wasAutoOpened = false;
          this.closeOverlay();
        }
      });

      // Alt+Tab: the window loses focus without being minimized
      this.mainWindow.on("blur", () => {
        this.clearBlurTimeout();
        // wait for the newly focused window to be known
        this.blurTimeout = setTimeout(() => {
          this.blurTimeout = null;
          const main = this.mainWindow;
          if (!main || main.isDestroyed()) return;
          const show = shouldShowOnBackground({
            enabled: this.enabled,
            autoShow: this.autoShowOnMinimize,
            mainMinimized: main.isMinimized(),
            mainVisible: main.isVisible(),
            mainFocused: main.isFocused(),
            appWindowFocused: BrowserWindow.getFocusedWindow() !== null,
            overlayShown: this.isOverlayShown(),
          });
          if (!show) return;
          this.wasAutoOpened = true;
          this.showOverlay();
        }, 150);
      });

      this.mainWindow.on("focus", () => {
        this.clearBlurTimeout();
        // some window managers send focus while minimizing; restore handles that case
        if (this.mainWindow?.isMinimized()) return;
        if (this.wasAutoOpened) {
          this.wasAutoOpened = false;
          this.closeOverlay();
        }
      });

      this.mainWindow.on("closed", () => {
        this.destroy();
      });
    }
  }

  private clearBlurTimeout() {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
  }

  private isOverlayShown(): boolean {
    return Boolean(
      this.overlayWindow &&
        !this.overlayWindow.isDestroyed() &&
        this.overlayWindow.isVisible() &&
        !this.closeTimeout,
    );
  }

  public destroy() {
    this.stopMoveAnimation();
    this.clearBlurTimeout();
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    this.unregisterShortcut();
    this.unregisterLikeShortcut();
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        this.overlayWindow.destroy();
      } catch {}
    }
    this.overlayWindow = null;
    this.mainWindow = null;
  }

  /** permanent teardown for app quit; unlike destroy() nothing can revive the overlay afterwards */
  public dispose() {
    this.disposed = true;
    this.destroy();
  }

  public pauseShortcuts(paused: boolean) {
    this.shortcutsPaused = paused;
    if (paused) {
      this.unregisterShortcut();
      this.unregisterLikeShortcut();
    } else {
      if (this.enabled) {
        this.registerShortcut();
      } else {
        this.registerLikeShortcut();
      }
    }
  }

  public registerShortcut(newShortcut?: string) {
    if (this.disposed) return;
    if (newShortcut) {
      this.shortcut = normalizeShortcut(newShortcut);
    } else if (this.shortcut) {
      this.shortcut = normalizeShortcut(this.shortcut);
    }

    this.unregisterShortcut();

    if (this.shortcutsPaused || !this.enabled || !this.shortcut) return;

    try {
      const ok = globalShortcut.register(this.shortcut, () => {
        if (!this.isAuthenticated || !this.enabled) return;
        this.toggleOverlay();
      });
      if (ok) {
        this.currentRegisteredShortcut = this.shortcut;
      } else {
        console.warn("[overlay] Failed to register global shortcut:", this.shortcut);
      }
    } catch (e) {
      console.error("[overlay] Error registering global shortcut:", e);
    }

    // Ensure like shortcut is also active
    this.registerLikeShortcut();
  }

  public unregisterShortcut() {
    if (this.currentRegisteredShortcut) {
      try {
        globalShortcut.unregister(this.currentRegisteredShortcut);
      } catch {}
      this.currentRegisteredShortcut = null;
    }
    if (this.shortcut) {
      try {
        globalShortcut.unregister(this.shortcut);
      } catch {}
    }
  }

  public registerLikeShortcut(newShortcut?: string) {
    if (this.disposed) return;
    if (newShortcut) {
      this.likeShortcut = normalizeShortcut(newShortcut);
    } else if (this.likeShortcut) {
      this.likeShortcut = normalizeShortcut(this.likeShortcut);
    }

    this.unregisterLikeShortcut();

    if (this.shortcutsPaused || !this.likeShortcut) return;

    try {
      const ok = globalShortcut.register(this.likeShortcut, () => {
        if (!this.isAuthenticated) return;
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("overlay:action", {
            type: "like",
            payload: { fromGlobalShortcut: true },
            fromGlobalShortcut: true,
          });
        }
      });
      if (ok) {
        this.currentRegisteredLikeShortcut = this.likeShortcut;
      } else {
        console.warn("[overlay] Failed to register global like shortcut:", this.likeShortcut);
      }
    } catch (e) {
      console.error("[overlay] Error registering global like shortcut:", e);
    }
  }

  public unregisterLikeShortcut() {
    if (this.currentRegisteredLikeShortcut) {
      try {
        globalShortcut.unregister(this.currentRegisteredLikeShortcut);
      } catch {}
      this.currentRegisteredLikeShortcut = null;
    }
    if (this.likeShortcut) {
      try {
        globalShortcut.unregister(this.likeShortcut);
      } catch {}
    }
  }

  private getTargetHeight(): number {
    return 56;
  }

  private getWindowBounds(width = 320, height?: number) {
    let targetDisplay = screen.getPrimaryDisplay();
    try {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        targetDisplay = screen.getDisplayMatching(this.overlayWindow.getBounds());
      } else if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        targetDisplay = screen.getDisplayMatching(this.mainWindow.getBounds());
      }
    } catch {
      targetDisplay = screen.getPrimaryDisplay();
    }

    const { workArea } = targetDisplay;
    const padding = 20;
    const finalHeight = height ?? this.getTargetHeight();

    let x: number;
    const y = Math.round(workArea.y + padding);

    switch (this.position) {
      case "top-left":
        x = Math.round(workArea.x + padding);
        break;
      case "top-right":
        x = Math.round(workArea.x + workArea.width - width - padding);
        break;
      case "top-center":
      default:
        x = Math.round(workArea.x + (workArea.width - width) / 2);
        break;
    }

    return { x, y, width, height: finalHeight };
  }

  private stopMoveAnimation() {
    if (this.moveAnimationTimer) {
      clearInterval(this.moveAnimationTimer);
      this.moveAnimationTimer = null;
    }
  }

  private animateWindowBounds(targetBounds: { x: number; y: number; width: number; height: number }, durationMs = 140) {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;

    this.stopMoveAnimation();

    const startX = this.currentAnimatedX ?? this.overlayWindow.getBounds().x;

    if (startX === targetBounds.x) {
      this.currentAnimatedX = null;
      return;
    }

    const startTime = performance.now();
    // Cubic ease out: 1 - Math.pow(1 - t, 3)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const interval = 8;

    this.moveAnimationTimer = setInterval(() => {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        this.stopMoveAnimation();
        this.currentAnimatedX = null;
        return;
      }

      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);

      const currentX = Math.round(startX + (targetBounds.x - startX) * eased);
      this.currentAnimatedX = currentX;

      this.overlayWindow.setBounds({
        x: currentX,
        y: targetBounds.y,
        width: targetBounds.width,
        height: targetBounds.height,
      });

      if (progress >= 1) {
        this.stopMoveAnimation();
        this.currentAnimatedX = null;
        this.overlayWindow.setBounds(targetBounds);
      }
    }, interval);
  }

  /** where the overlay pill sits (or will sit) on screen, in dip */
  public getPillBounds(): { x: number; y: number; width: number; height: number } {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible()) {
      return this.overlayWindow.getBounds();
    }
    return this.getWindowBounds();
  }

  /** minimizing the main window will bring the overlay up */
  public willShowOnMinimize(): boolean {
    return !this.disposed && this.isAuthenticated && this.enabled && this.autoShowOnMinimize;
  }

  /**
   * open the overlay for an animated hand-off: `beforeShow` runs as soon as the window
   * exists (main cloaks it there, so it can paint unseen), then the overlay is shown and
   * marked as opened by minimize. resolves with the window once it has loaded.
   */
  public async openForTransition(beforeShow: (win: BrowserWindow) => void): Promise<BrowserWindow | null> {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return null;
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    let fresh = false;
    this.prewarming = false; // being opened for real now
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.createOverlayWindow();
      fresh = true;
    }
    const win = this.overlayWindow;
    if (!win || win.isDestroyed()) return null;
    beforeShow(win);
    if (fresh) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        win.once("ready-to-show", done);
        setTimeout(done, 1200);
      });
    }
    if (win.isDestroyed()) return null;
    this.showOverlay();
    this.wasAutoOpened = true;
    return win;
  }

  /** the window is coming back with an animated hand-off: don't auto-close on restore */
  public holdForTransition() {
    this.wasAutoOpened = false;
  }

  /**
   * create the overlay window hidden in the background, so the first hand-off from
   * the main window doesn't wait for it to be created and loaded
   */
  public prewarm() {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return;
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) return;
    this.prewarming = true;
    this.createOverlayWindow();
  }

  private prewarming = false;
  private prewarmEnabled = false;

  /** keep a hidden overlay ready whenever signed in (main enables it with the transform) */
  public enablePrewarm() {
    this.prewarmEnabled = true;
    if (this.isAuthenticated) setTimeout(() => this.prewarm(), 1500);
  }

  /** the overlay window, when it exists */
  public getWindow(): BrowserWindow | null {
    return this.overlayWindow && !this.overlayWindow.isDestroyed() ? this.overlayWindow : null;
  }

  // main installs this to animate the window back out of the overlay (F in the overlay)
  private focusMainHandler: ((restore: () => void) => void) | null = null;

  public setFocusMainHandler(handler: ((restore: () => void) => void) | null) {
    this.focusMainHandler = handler;
  }

  public showOverlay() {
    if (!this.isAuthenticated || !this.enabled) return;

    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      const bounds = this.getWindowBounds();
      const currentBounds = this.overlayWindow.getBounds();
      if (
        currentBounds.x !== bounds.x ||
        currentBounds.y !== bounds.y ||
        currentBounds.width !== bounds.width ||
        currentBounds.height !== bounds.height
      ) {
        this.overlayWindow.setBounds(bounds);
      }
      if (this.latestState) {
        this.overlayWindow.webContents.send("overlay:state", this.latestState);
      }
      this.overlayWindow.webContents.send("overlay:visibility", true);
      if (!this.overlayWindow.isVisible()) {
        this.overlayWindow.showInactive();
      }
      this.applyAlwaysOnTop();
      return;
    }
    this.createOverlayWindow();
  }

  public toggleOverlay(): boolean {
    if (!this.isAuthenticated || !this.enabled) {
      this.closeOverlay();
      return false;
    }

    this.wasAutoOpened = false;
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (this.overlayWindow.isVisible() && !this.closeTimeout) {
        this.closeOverlay();
        return false;
      } else {
        this.showOverlay();
        return true;
      }
    }

    this.createOverlayWindow();
    return true;
  }

  public closeOverlay() {
    this.wasAutoOpened = false;
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (this.overlayWindow.isVisible()) {
        this.overlayWindow.webContents.send("overlay:visibility", false);
        this.closeTimeout = setTimeout(() => {
          if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.hide();
          }
          this.closeTimeout = null;
        }, 90);
      } else {
        this.overlayWindow.hide();
      }
    }
  }

  private applyAlwaysOnTop() {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;

    if (!this.alwaysOnTop) {
      try {
        this.overlayWindow.setAlwaysOnTop(false, "normal");
      } catch {
        try {
          this.overlayWindow.setAlwaysOnTop(false);
        } catch {}
      }
      return;
    }

    try {
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {}

    const elevate = () => {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
      try {
        this.overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      } catch {
        try {
          this.overlayWindow.setAlwaysOnTop(true, "floating");
        } catch {
          this.overlayWindow.setAlwaysOnTop(true);
        }
      }
      try {
        this.overlayWindow.moveTop();
      } catch {}
    };

    elevate();
    // Re-assert after OS focus transition to guarantee priority over fullscreen windows
    setTimeout(elevate, 100);
  }

  public setAuthenticated(authenticated: boolean) {
    const was = this.isAuthenticated;
    this.isAuthenticated = Boolean(authenticated);
    if (!this.isAuthenticated) {
      this.closeOverlay();
    } else if (!was && this.prewarmEnabled) {
      setTimeout(() => this.prewarm(), 1500);
    }
  }

  private createOverlayWindow() {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return;
    const bounds = this.getWindowBounds();

    this.overlayWindow = new BrowserWindow({
      title: "Liner Overlay",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      show: false,
      alwaysOnTop: this.alwaysOnTop,
      resizable: false,
      skipTaskbar: true,
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

    this.overlayWindow.once("ready-to-show", () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        // created ahead of time: stay hidden until something actually opens it
        if (this.prewarming) {
          this.prewarming = false;
          return;
        }
        if (!this.isAuthenticated || !this.enabled) {
          this.overlayWindow.hide();
          return;
        }
        if (this.latestState) {
          this.overlayWindow.webContents.send("overlay:state", this.latestState);
        }
        this.overlayWindow.webContents.send("overlay:visibility", true);
        this.overlayWindow.showInactive();
        this.applyAlwaysOnTop();
      }
    });

    this.applyAlwaysOnTop();

    const targetUrl = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL}#/overlay`
      : `file://${path.join(this.rendererDist, "index.html")}#/overlay`;

    this.overlayWindow.loadURL(targetUrl);

    this.overlayWindow.webContents.on("did-finish-load", () => {
      if (this.latestState && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.webContents.send("overlay:state", this.latestState);
      }
    });

    this.overlayWindow.on("closed", () => {
      this.overlayWindow = null;
    });
  }

  private registerIpcHandlers() {
    ipcMain.on("overlay:set-authenticated", (_event, authenticated: boolean) => {
      this.setAuthenticated(authenticated);
    });

    ipcMain.on("overlay:update-state", (_event, state: any) => {
      if (!this.isAuthenticated) return;
      this.latestState = state;

      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.webContents.send("overlay:state", state);
      }
    });

    ipcMain.on("overlay:send-action", (_event, action: any) => {
      if (action.type === "closeOverlay") {
        this.closeOverlay();
        return;
      }
      if (action.type === "focusMainWindow") {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          const win = this.mainWindow;
          const restore = () => {
            if (win.isDestroyed()) return;
            if (win.isMinimized()) {
              win.restore();
            }
            win.show();
            win.focus();
          };
          // animated (windows 11 add-on) only when coming back from minimized
          if (this.focusMainHandler && win.isMinimized()) this.focusMainHandler(restore);
          else restore();
        }
        return;
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("overlay:action", action);
      }
    });

    ipcMain.handle("overlay:get-initial-state", () => {
      if (!this.isAuthenticated) return null;
      return this.latestState;
    });

    ipcMain.handle("overlay:toggle", () => {
      if (!this.isAuthenticated) return false;
      return this.toggleOverlay();
    });

    ipcMain.handle("overlay:is-open", () => {
      return Boolean(this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible());
    });

    ipcMain.on("overlay:close", () => {
      this.closeOverlay();
    });

    ipcMain.on("overlay:pause-shortcuts", (_event, paused: boolean) => {
      this.pauseShortcuts(Boolean(paused));
    });

    ipcMain.on("overlay:update-settings", (_event, settings: Partial<OverlaySettings>) => {
      if (!settings || typeof settings !== "object") return;

      if (typeof settings.enabled === "boolean") {
        this.enabled = settings.enabled;
        if (!this.enabled) {
          this.closeOverlay();
          this.unregisterShortcut();
        } else {
          this.registerShortcut();
        }
      }

      let shouldAnimate = false;
      if (
        settings.position === "top-left" ||
        settings.position === "top-center" ||
        settings.position === "top-right"
      ) {
        const changed = this.position !== settings.position;
        this.position = settings.position;
        if (changed && this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible()) {
          shouldAnimate = true;
        }
      }

      if (typeof settings.shortcut === "string" && settings.shortcut.trim()) {
        const nextShortcut = settings.shortcut.trim();
        if (nextShortcut !== this.shortcut) {
          this.shortcut = nextShortcut;
          if (this.enabled) {
            this.registerShortcut();
          }
        }
      }

      if (typeof settings.likeShortcut === "string" && settings.likeShortcut.trim()) {
        const nextLikeShortcut = settings.likeShortcut.trim();
        if (nextLikeShortcut !== this.likeShortcut) {
          this.likeShortcut = nextLikeShortcut;
          this.registerLikeShortcut();
        }
      }

      if (typeof settings.autoShowOnMinimize === "boolean") {
        this.autoShowOnMinimize = settings.autoShowOnMinimize;
      }

      if (typeof settings.alwaysOnTop === "boolean") {
        this.alwaysOnTop = settings.alwaysOnTop;
        this.applyAlwaysOnTop();
      }

      if (shouldAnimate) {
        const targetBounds = this.getWindowBounds();
        this.animateWindowBounds(targetBounds);
      } else if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        const bounds = this.getWindowBounds();
        this.overlayWindow.setBounds(bounds);
      }

      this.savePersistedSettings();
    });
  }
}
