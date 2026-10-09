import { BrowserWindow, ipcMain, screen, globalShortcut, app } from "electron";
import path from "node:path";
import fs from "node:fs";

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

  private moveAnimationTimer: NodeJS.Timeout | null = null;
  private currentAnimatedX: number | null = null;
  private closeTimeout: NodeJS.Timeout | null = null;

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
        if (!this.enabled || !this.autoShowOnMinimize) return;
        this.wasAutoOpened = true;
        this.showOverlay();
      });

      this.mainWindow.on("restore", () => {
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

  public destroy() {
    this.stopMoveAnimation();
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
    if (newShortcut) {
      this.shortcut = normalizeShortcut(newShortcut);
    } else if (this.shortcut) {
      this.shortcut = normalizeShortcut(this.shortcut);
    }

    this.unregisterShortcut();

    if (this.shortcutsPaused || !this.enabled || !this.shortcut) return;

    try {
      const ok = globalShortcut.register(this.shortcut, () => {
        if (!this.enabled) return;
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
    if (newShortcut) {
      this.likeShortcut = normalizeShortcut(newShortcut);
    } else if (this.likeShortcut) {
      this.likeShortcut = normalizeShortcut(this.likeShortcut);
    }

    this.unregisterLikeShortcut();

    if (this.shortcutsPaused || !this.likeShortcut) return;

    try {
      const ok = globalShortcut.register(this.likeShortcut, () => {
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

  public showOverlay() {
    if (!this.enabled) return;

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
      return;
    }
    this.createOverlayWindow();
  }

  public toggleOverlay(): boolean {
    if (!this.enabled) {
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

  private createOverlayWindow() {
    if (!this.enabled) return;
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
        if (this.latestState) {
          this.overlayWindow.webContents.send("overlay:state", this.latestState);
        }
        this.overlayWindow.webContents.send("overlay:visibility", true);
        this.overlayWindow.showInactive();
      }
    });

    if (process.platform === "darwin") {
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.overlayWindow.setAlwaysOnTop(this.alwaysOnTop, "floating");
    } else {
      this.overlayWindow.setAlwaysOnTop(this.alwaysOnTop);
    }

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
    ipcMain.on("overlay:update-state", (_event, state: any) => {
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
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.show();
          this.mainWindow.focus();
        }
        return;
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("overlay:action", action);
      }
    });

    ipcMain.handle("overlay:get-initial-state", () => {
      return this.latestState;
    });

    ipcMain.handle("overlay:toggle", () => {
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
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.setAlwaysOnTop(this.alwaysOnTop);
        }
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
