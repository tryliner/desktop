import { BrowserWindow, ipcMain, screen, globalShortcut, app } from "electron";
import path from "node:path";
import fs from "node:fs";
import {
  createCompositorBridge,
  type CompositorBridge,
} from "./compositor/index.js";

export type OverlayPosition = "top-left" | "top-center" | "top-right";

const OVERLAY_TITLE = "Liner Overlay";
const OVERLAY_MARGIN = 20;
const TOGGLE_ACTION = "toggle-overlay";
const LIKE_ACTION = "like-track";
const COMPOSITOR_SETTLE_MS = 300;

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

const WARM_DELAY_MS = 600;
const REVEAL_FALLBACK_MS = 2_500;
const LEGACY_READY_FALLBACK_MS = 1_500;
const TRANSITION_READY_WAIT_MS = 1_200;
const CRASH_WINDOW_MS = 60_000;
const MAX_CRASHES_PER_WINDOW = 3;
const PRIME_PAINT_WAIT_MS = 600;
const PRIME_SETTLE_MS = 50;

function waitForFrame(win: BrowserWindow, timeoutMs: number): Promise<void> {
  const painted = win.webContents
    .executeJavaScript("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))", false)
    .then(() => undefined)
    .catch(() => undefined);
  return Promise.race([painted, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
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
  private compositor: CompositorBridge | null = null;
  private rendererAuthenticated = false;
  private authSource: (() => boolean) | null = null;
  private contentReady = false;
  private pendingShow = false;
  private readyWaiters: Array<() => void> = [];
  private warmTimer: NodeJS.Timeout | null = null;
  private readyFallbackTimer: NodeJS.Timeout | null = null;
  private revealFallbackTimer: NodeJS.Timeout | null = null;
  private crashTimes: number[] = [];
  private crashCooldownUntil = 0;
  private primed = false;
  private priming = false;
  private wantVisible = false;
  private indexPathResolver: (() => string) | null = null;
  private loadedIndexPath: string | null = null;

  constructor(preloadPath: string, rendererDist: string) {
    this.preloadPath = preloadPath;
    this.rendererDist = rendererDist;
    this.loadPersistedSettings();
    this.registerIpcHandlers();
    this.compositor = createCompositorBridge((action) =>
      this.handleCompositorAction(action),
    );
  }

  private handleCompositorAction(action: string) {
    if (action === TOGGLE_ACTION) {
      if (this.isAuthenticated && this.enabled) this.toggleOverlay();
      return;
    }
    if (action === LIKE_ACTION) this.triggerLike();
  }

  private triggerLike() {
    if (!this.isAuthenticated) return;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("overlay:action", {
        type: "like",
        payload: { fromGlobalShortcut: true },
        fromGlobalShortcut: true,
      });
    }
  }

  private placeWithCompositor(): Promise<boolean> {
    if (!this.compositor) return Promise.resolve(false);
    const { width, height } = this.getWindowBounds();
    return this.compositor.placeOverlay({
      title: OVERLAY_TITLE,
      width,
      height,
      anchor: this.position,
      pinned: this.alwaysOnTop,
      margin: OVERLAY_MARGIN,
    });
  }

  private revealWindow() {
    const win = this.overlayWindow;
    if (!win || win.isDestroyed()) return;
    const compositor = this.compositor;
    if (!compositor) {
      win.showInactive();
      this.applyAlwaysOnTop();
      return;
    }
    void compositor.captureFocus().finally(() => {
      if (win.isDestroyed()) return;
      win.showInactive();
      void this.placeWithCompositor().then(() => {
        setTimeout(() => {
          if (!win.isDestroyed() && win.isVisible()) {
            void this.placeWithCompositor();
          }
        }, COMPOSITOR_SETTLE_MS);
      });
    });
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
        if (this.restoreInterceptor?.()) {
          this.wasAutoOpened = false;
          return;
        }
        if (this.wasAutoOpened) {
          this.wasAutoOpened = false;
          this.closeOverlay();
        }
      });

      this.mainWindow.on("closed", () => {
        this.destroy();
      });

      this.mainWindow.webContents.on("did-finish-load", () => this.syncBundle());
    }
  }

  public destroy() {
    this.stopMoveAnimation();
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    this.clearLifecycleTimers();
    this.pendingShow = false;
    this.resetContentReady();
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
    void this.compositor?.dispose();
    this.compositor = null;
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

    const shortcut = this.shortcut;
    if (this.compositor) {
      void this.compositor.bindShortcut(TOGGLE_ACTION, shortcut).then((ok) => {
        if (!ok && !this.disposed && this.shortcut === shortcut) {
          this.registerGlobalToggle();
        }
      });
    } else {
      this.registerGlobalToggle();
    }

    // Ensure like shortcut is also active
    this.registerLikeShortcut();
  }

  private registerGlobalToggle() {
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
  }

  public unregisterShortcut() {
    if (this.compositor) void this.compositor.unbindShortcut(TOGGLE_ACTION);
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

    if (this.compositor) {
      const likeShortcut = this.likeShortcut;
      void this.compositor
        .bindShortcut(LIKE_ACTION, likeShortcut)
        .then((ok) => {
          if (!ok && !this.disposed && this.likeShortcut === likeShortcut) {
            this.registerGlobalLike();
          }
        });
      return;
    }

    this.registerGlobalLike();
  }

  private registerGlobalLike() {
    if (!this.likeShortcut) return;
    try {
      const ok = globalShortcut.register(this.likeShortcut, () => this.triggerLike());
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
    if (this.compositor) void this.compositor.unbindShortcut(LIKE_ACTION);
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

  public async openForTransition(beforeShow: (win: BrowserWindow) => void): Promise<BrowserWindow | null> {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return null;
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    const win = this.ensureWindow();
    if (!win) return null;
    beforeShow(win);
    if (!this.contentReady) await this.waitForContent(TRANSITION_READY_WAIT_MS);
    if (win.isDestroyed() || this.overlayWindow !== win) return null;
    this.pendingShow = true;
    this.reveal();
    this.wasAutoOpened = true;
    return win;
  }

  public holdForTransition() {
    this.wasAutoOpened = false;
  }

  public prewarm() {
    this.ensureWindow();
  }

  public enablePrewarm() {
    this.scheduleWarm();
  }

  public setIndexPathResolver(resolve: () => string) {
    this.indexPathResolver = resolve;
  }

  private currentIndexPath(): string {
    return this.indexPathResolver?.() ?? path.join(this.rendererDist, "index.html");
  }

  private syncBundle() {
    const win = this.overlayWindow;
    if (!win || win.isDestroyed() || process.env.VITE_DEV_SERVER_URL) return;
    if (this.loadedIndexPath === this.currentIndexPath() || win.isVisible() || this.pendingShow) return;
    this.overlayWindow = null;
    this.resetContentReady();
    try {
      win.destroy();
    } catch {}
    this.scheduleWarm();
  }

  public isReadyForTransition(): boolean {
    const win = this.getWindow();
    return Boolean(win) && this.contentReady && this.primed && !this.priming;
  }

  private primeSurface(win: BrowserWindow) {
    if (process.platform !== "win32" || this.primed || this.priming) return;
    if (win.isVisible()) {
      this.primed = true;
      return;
    }
    this.priming = true;
    void (async () => {
      try {
        win.setOpacity(0);
        win.showInactive();
        await waitForFrame(win, PRIME_PAINT_WAIT_MS);
        await new Promise<void>((resolve) => setTimeout(resolve, PRIME_SETTLE_MS));
      } catch {}
      this.priming = false;
      if (win.isDestroyed() || this.overlayWindow !== win) return;
      if (!this.wantVisible) win.hide();
      win.setOpacity(1);
      this.primed = true;
    })();
  }

  public bindAuthSource(isSignedIn: () => boolean, subscribe: (listener: () => void) => void) {
    this.authSource = isSignedIn;
    subscribe(() => this.refreshAuth());
    this.refreshAuth();
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

  private restoreInterceptor: (() => boolean) | null = null;

  public setRestoreInterceptor(interceptor: (() => boolean) | null) {
    this.restoreInterceptor = interceptor;
  }

  public showOverlay() {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return;

    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    this.pendingShow = true;
    if (!this.ensureWindow()) {
      this.pendingShow = false;
      return;
    }
    if (this.contentReady) {
      this.reveal();
      return;
    }
    if (!this.revealFallbackTimer) {
      this.revealFallbackTimer = setTimeout(() => {
        this.revealFallbackTimer = null;
        this.reveal();
      }, REVEAL_FALLBACK_MS);
    }
  }

  private reveal() {
    if (!this.pendingShow) return;
    this.pendingShow = false;
    if (this.revealFallbackTimer) {
      clearTimeout(this.revealFallbackTimer);
      this.revealFallbackTimer = null;
    }
    const win = this.overlayWindow;
    if (!win || win.isDestroyed() || !this.isAuthenticated || !this.enabled) return;
    this.wantVisible = true;
    const bounds = this.getWindowBounds();
    const currentBounds = win.getBounds();
    if (
      currentBounds.x !== bounds.x ||
      currentBounds.y !== bounds.y ||
      currentBounds.width !== bounds.width ||
      currentBounds.height !== bounds.height
    ) {
      win.setBounds(bounds);
    }
    if (this.latestState) {
      win.webContents.send("overlay:state", this.latestState);
    }
    win.webContents.send("overlay:visibility", true);
    win.setOpacity(1);
    this.primed = true;
    this.revealWindow();
  }

  private ensureWindow(): BrowserWindow | null {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return null;
    if (Date.now() < this.crashCooldownUntil) return null;
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.createOverlayWindow();
    }
    return this.overlayWindow && !this.overlayWindow.isDestroyed() ? this.overlayWindow : null;
  }

  private scheduleWarm() {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return;
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) return;
    if (this.warmTimer) return;
    this.warmTimer = setTimeout(() => {
      this.warmTimer = null;
      this.ensureWindow();
    }, WARM_DELAY_MS);
  }

  private markContentReady() {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    if (this.contentReady) return;
    this.contentReady = true;
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const resolve of waiters) resolve();
    this.reveal();
    const win = this.overlayWindow;
    if (win && !win.isDestroyed()) this.primeSurface(win);
  }

  private resetContentReady() {
    this.contentReady = false;
    this.primed = false;
    this.priming = false;
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const resolve of waiters) resolve();
  }

  private waitForContent(timeoutMs: number): Promise<void> {
    if (this.contentReady) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      this.readyWaiters.push(done);
    });
  }

  private clearLifecycleTimers() {
    for (const timer of [this.warmTimer, this.readyFallbackTimer, this.revealFallbackTimer]) {
      if (timer) clearTimeout(timer);
    }
    this.warmTimer = null;
    this.readyFallbackTimer = null;
    this.revealFallbackTimer = null;
  }

  private handleRendererGone(win: BrowserWindow, reason: string) {
    if (this.overlayWindow !== win) return;
    console.warn(`[overlay] renderer gone (${reason}), rebuilding the overlay`);
    this.overlayWindow = null;
    this.resetContentReady();
    try {
      win.destroy();
    } catch {}
    const now = Date.now();
    this.crashTimes = this.crashTimes.filter((t) => now - t < CRASH_WINDOW_MS);
    this.crashTimes.push(now);
    if (this.crashTimes.length > MAX_CRASHES_PER_WINDOW) {
      console.error("[overlay] renderer keeps crashing, not rebuilding it for now");
      this.crashTimes = [];
      this.crashCooldownUntil = now + CRASH_WINDOW_MS;
      this.pendingShow = false;
      this.clearLifecycleTimers();
      return;
    }
    if (this.pendingShow) this.showOverlay();
    else this.scheduleWarm();
  }

  public toggleOverlay(): boolean {
    if (!this.isAuthenticated || !this.enabled) {
      this.closeOverlay();
      return false;
    }

    this.wasAutoOpened = false;
    if (this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible() && !this.closeTimeout) {
      this.closeOverlay();
      return false;
    }
    this.showOverlay();
    return true;
  }

  public closeOverlay() {
    this.wasAutoOpened = false;
    this.pendingShow = false;
    this.wantVisible = false;
    if (this.revealFallbackTimer) {
      clearTimeout(this.revealFallbackTimer);
      this.revealFallbackTimer = null;
    }
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

    if (this.compositor) {
      if (this.overlayWindow.isVisible()) void this.placeWithCompositor();
      return;
    }

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
      if (!this.wantVisible) return;
      try {
        this.overlayWindow.moveTop();
      } catch {}
    };

    elevate();
    // Re-assert after OS focus transition to guarantee priority over fullscreen windows
    setTimeout(elevate, 100);
  }

  public setAuthenticated(authenticated: boolean) {
    this.rendererAuthenticated = Boolean(authenticated);
    this.refreshAuth();
  }

  private refreshAuth() {
    const was = this.isAuthenticated;
    this.isAuthenticated = this.rendererAuthenticated || Boolean(this.authSource?.());
    if (!this.isAuthenticated) {
      this.closeOverlay();
    } else if (!was) {
      this.scheduleWarm();
    }
  }

  private createOverlayWindow() {
    if (this.disposed || !this.isAuthenticated || !this.enabled) return;
    const bounds = this.getWindowBounds();

    this.overlayWindow = new BrowserWindow({
      title: OVERLAY_TITLE,
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

    const win = this.overlayWindow;
    this.resetContentReady();
    win.webContents.on("render-process-gone", (_event, details) => this.handleRendererGone(win, details.reason));
    win.webContents.on("did-finish-load", () => {
      if (this.overlayWindow !== win || this.contentReady) return;
      if (this.readyFallbackTimer) clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = setTimeout(() => {
        this.readyFallbackTimer = null;
        if (this.overlayWindow === win) this.markContentReady();
      }, LEGACY_READY_FALLBACK_MS);
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      this.loadedIndexPath = null;
      void win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/overlay`);
    } else {
      this.loadedIndexPath = this.currentIndexPath();
      void win.loadFile(this.loadedIndexPath, { hash: "/overlay" });
    }

    this.overlayWindow.webContents.on("did-finish-load", () => {
      if (this.latestState && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.webContents.send("overlay:state", this.latestState);
      }
    });

    this.overlayWindow.on("page-title-updated", (event) => event.preventDefault());

    this.overlayWindow.on("closed", () => {
      if (this.overlayWindow !== win) return;
      this.overlayWindow = null;
      this.resetContentReady();
    });
  }

  private registerIpcHandlers() {
    ipcMain.on("overlay:set-authenticated", (_event, authenticated: boolean) => {
      this.setAuthenticated(authenticated);
    });

    ipcMain.on("overlay:ready", (event) => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed() && event.sender === this.overlayWindow.webContents) {
        this.markContentReady();
      }
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
          this.scheduleWarm();
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

      if (this.compositor) {
        if (
          this.overlayWindow &&
          !this.overlayWindow.isDestroyed() &&
          this.overlayWindow.isVisible()
        ) {
          void this.placeWithCompositor();
        }
      } else if (shouldAnimate) {
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
