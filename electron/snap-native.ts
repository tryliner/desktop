// Drives the native snap preview add-on (native/snap-preview, windows only).
//
// The add-on owns a popup window whose content is a DWM composition tree: a live
// blur (HostBackdropBrush) inside a rounded clip that the compositor animates.
// This controller only decides *what* to animate; frames are produced by DWM at
// the display refresh rate, so there is no per-frame work in the app.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import os from "node:os";
import { screen, type BrowserWindow, type Display, type Rectangle } from "electron";
import { cubicBezier, lerpEdges, toEdges, type Edges } from "./window-drag.js";

interface SnapPreviewAddon {
  init(): boolean;
  hasBackdrop(): boolean;
  placeOnCursorMonitor(): [number, number, number, number] | undefined;
  windowRect(hwnd: Buffer): Edges | undefined;
  placeOnWindowMonitor(hwnd: Buffer): [number, number, number, number] | undefined;
  beginMorph(hwnd: Buffer, from?: Edges, opacity?: number): boolean;
  runMorph(
    from: Edges,
    to: Edges,
    ms: number,
    bezier: [number, number, number, number],
    autoReveal?: boolean,
    opacityFrom?: number,
    opacityTo?: number,
  ): void;
  revealMorph(): void;
  endMorph(): void;
  cloak(hwnd: Buffer, on: boolean): void;
  setTransitionsDisabled?(hwnd: Buffer, disabled: boolean): void;
  minimizeKeepingPreview?(hwnd: Buffer): void;
  armRestoreTrap?(hwnd: Buffer, armed: boolean): void;
  takeRestoredCloaked?(): boolean;
  transform(
    from: Edges,
    to: Edges,
    ms: number,
    bezier: [number, number, number, number],
    radiusFrom: number,
    radiusTo: number,
    outHwnd: Buffer,
    inHwnd: Buffer,
  ): boolean;
  endTransform(): void;
  setMorphTarget(to: Edges): void;
  setArea(x: number, y: number, width: number, height: number): void;
  setStyle(argbTint: number, radiusPx: number): void;
  show(afterHwnd: Buffer | null): void;
  hide(): void;
  animate(from: Edges, to: Edges, ms: number, bezier: [number, number, number, number]): void;
  setTarget(to: Edges): void;
  destroy(): void;
}

/** the built add-on, or null (not built, not windows, or it failed to load) */
export function loadSnapPreviewAddon(appRoot: string): SnapPreviewAddon | null {
  if (!isWindows11()) return null;
  const candidates = [path.join(appRoot, "native", "snap-preview", "build", "Release", "snap_preview.node")].map((p) =>
    // packaged: native files are unpacked next to the asar
    p.includes(`app.asar${path.sep}`) ? p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`) : p,
  );
  const require = createRequire(import.meta.url);
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const addon = require(file) as SnapPreviewAddon;
      // an add-on built from older sources lacks newer functions: rebuild needed
      const required = [
        "init",
        "placeOnCursorMonitor",
        "placeOnWindowMonitor",
        "windowRect",
        "animate",
        "setTarget",
        "show",
        "hide",
        "beginMorph",
        "runMorph",
        "endMorph",
        "setMorphTarget",
        "revealMorph",
        "cloak",
        "transform",
        "endTransform",
      ] as const;
      const missing = required.filter((name) => typeof (addon as unknown as Record<string, unknown>)?.[name] !== "function");
      if (missing.length === 0) return addon;
      console.warn(`[snap-preview] add-on is outdated (missing ${missing.join(", ")}): run pnpm native:build`);
    } catch (err) {
      console.warn("[snap-preview] native add-on failed to load:", err);
    }
  }
  return null;
}

/** windows 11 is build 22000+ (os.release() is "10.0.<build>") */
export function isWindows11(): boolean {
  return process.platform === "win32" && Number(os.release().split(".")[2] ?? 0) >= 22000;
}

type Bezier = [number, number, number, number];
const GROW_EASE: Bezier = [0.33, 1, 0.68, 1]; // ease-out
const COLLAPSE_EASE: Bezier = [0.65, 0, 0.35, 1]; // ease-in-out
const MORPH_EASE: Bezier = [0.2, 0.9, 0.1, 1]; // fast out, soft landing (like windows)
const MORPH_MS = 240;
const SHRINK_MS = 220; // (unused for now) shrink-first restore
const DRAG_OUT_MS = 200; // dragging out of maximize: a touch quicker, the window is moving
const PAINT_WAIT_MS = 150; // longest we wait for the app to paint at its new size
// window <-> overlay: a material-style container transform
const TO_OVERLAY_MS = 190; // into the pill: quick
const TRANSITIONS_RESTORE_MS = 400;
const FROM_OVERLAY_MS = 230; // back out: expanding reads better a touch slower
const EMPHASIZED: Bezier = [0.2, 0, 0, 1]; // quick departure, long gentle settle
const CONTAINER_TINT = 0xf0141416; // the app's dark surface, over the live blur
const WINDOW_RADIUS_DIP = 12; // the app frame's corners

/** resolves once the window's renderer has produced a frame (or after a timeout) */
function afterPaint(win: BrowserWindow): Promise<void> {
  const painted = win.webContents
    .executeJavaScript("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))", false)
    .then(() => undefined)
    .catch(() => undefined);
  return Promise.race([painted, new Promise<void>((r) => setTimeout(r, PAINT_WAIT_MS))]);
}

export interface NativeSnapOptions {
  insetDip: number; // gap between the box and the work area edges
  tuckInsetDip: number; // start / end inside the window, behind the app body
  radiusDip: number;
  growMs: number;
  collapseMs: number;
  tint: number; // 0xAARRGGBB over the blur
  tintNoBlur: number; // when no live blur is available (windows 10)
}

export class NativeSnapPreview {
  private visible = false;
  // the preview window's screen rect, physical px, from windows itself (work area of
  // the monitor under the cursor: never covers the taskbar)
  private area: { x: number; y: number; w: number; h: number } | null = null;
  private scale = 1;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private morphing = false; // a morph is landing (followMorph keeps it on the window)
  // the running animation, mirrored here so a turnaround starts exactly where it is
  private anim: { from: Edges; to: Edges; start: number; ms: number; ease: (t: number) => number } | null = null;

  private constructor(
    private readonly addon: SnapPreviewAddon,
    private readonly getMain: () => BrowserWindow | null,
    private readonly opts: NativeSnapOptions,
    private readonly blur: boolean,
  ) {}

  static create(addon: SnapPreviewAddon, getMain: () => BrowserWindow | null, opts: NativeSnapOptions) {
    try {
      if (!addon.init()) {
        const why = (addon as { lastError?: () => string }).lastError?.() ?? "unknown";
        console.warn(`[snap-preview] native init failed: ${why} (using the plain preview)`);
        return null;
      }
      const blur = addon.hasBackdrop();
      console.log(`[snap-preview] native compositor preview ready (live blur: ${blur ? "yes" : "no"})`);
      return new NativeSnapPreview(addon, getMain, opts, blur);
    } catch (err) {
      console.warn("[snap-preview] native init failed:", err);
      return null;
    }
  }

  // our window, tucked inside its own bounds (behind the app body), preview-local px
  private tuckedEdges(): Edges | null {
    const win = this.getMain();
    if (!win || win.isDestroyed() || !this.area) return null;
    const r = this.addon.windowRect(win.getNativeWindowHandle());
    if (!r) return null;
    const w = r[2] - r[0];
    const h = r[3] - r[1];
    const i = Math.min(Math.round(this.opts.tuckInsetDip * this.scale), Math.floor(w / 4), Math.floor(h / 4));
    const { x, y } = this.area;
    return [r[0] - x + i, r[1] - y + i, r[2] - x - i, r[3] - y - i];
  }

  private fullEdges(): Edges | null {
    if (!this.area) return null;
    const i = Math.round(this.opts.insetDip * this.scale);
    return [i, i, this.area.w - i, this.area.h - i];
  }

  private current(): Edges | null {
    const anim = this.anim;
    if (!anim) return null;
    const t = Math.min(1, (performance.now() - anim.start) / anim.ms);
    return lerpEdges(anim.from, anim.to, anim.ease(t));
  }

  private run(from: Edges, to: Edges, ms: number, bezier: Bezier) {
    this.addon.animate(from, to, ms, bezier);
    this.anim = { from, to, start: performance.now(), ms, ease: cubicBezier(...bezier) };
  }

  private clearHide() {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  // cover the work area of the monitor under the cursor (only ever moved while hidden)
  private place(display: Display) {
    if (this.visible) return;
    const a = this.addon.placeOnCursorMonitor();
    if (!a) return;
    this.area = { x: a[0], y: a[1], w: a[2], h: a[3] };
    this.scale = display.scaleFactor || 1;
    this.addon.setStyle(this.blur ? this.opts.tint : this.opts.tintNoBlur, Math.round(this.opts.radiusDip * this.scale));
  }

  /** prime once in the background: the compositor sets up its resources now */
  prime(display: Display) {
    this.place(display);
    const empty: Edges = [0, 0, 0, 0];
    this.addon.animate(empty, empty, 0, GROW_EASE);
    this.addon.show(null);
    setTimeout(() => {
      if (!this.visible) this.addon.hide();
    }, 200);
  }

  /** cursor hit the top edge: grow out of the window */
  arm(display: Display) {
    this.clearHide();
    this.place(display);
    const to = this.fullEdges();
    if (!to) return;
    if (this.visible) {
      // mid-collapse: turn around from where the box is right now
      const from = this.current() ?? this.tuckedEdges() ?? to;
      this.run(from, to, this.opts.growMs, GROW_EASE);
      return;
    }
    const from = this.tuckedEdges();
    if (!from) return;
    // the clip is set (behind the app) before the window shows, so no frame flashes
    this.run(from, to, this.opts.growMs, GROW_EASE);
    const win = this.getMain();
    this.addon.show(win && !win.isDestroyed() ? win.getNativeWindowHandle() : null);
    this.visible = true;
  }

  /** cursor left the edge: collapse back into the window (follow() keeps it on it) */
  collapse() {
    if (!this.visible) return;
    this.clearHide();
    const from = this.current() ?? this.fullEdges();
    const to = this.tuckedEdges();
    if (!from || !to) {
      this.hideNow();
      return;
    }
    this.run(from, to, this.opts.collapseMs, COLLAPSE_EASE);
    this.hideTimer = setTimeout(() => this.hideNow(), this.opts.collapseMs + 30);
  }

  /** while collapsing: aim at the window's live position */
  follow() {
    if (!this.visible || !this.hideTimer || !this.anim) return;
    const to = this.tuckedEdges();
    if (!to) return;
    this.anim.to = to;
    this.addon.setTarget(to);
  }

  // show the (empty) add-on window if nothing is up yet: it is only the surface the
  // morph thumbnail is drawn on. returns false if it can't be used
  private surfaceFor(hwnd: Buffer): boolean {
    if (this.visible) return true;
    const a = this.addon.placeOnWindowMonitor(hwnd);
    if (!a) return false;
    this.area = { x: a[0], y: a[1], w: a[2], h: a[3] };
    const empty: Edges = [0, 0, 0, 0];
    this.addon.animate(empty, empty, 0, GROW_EASE);
    this.anim = null;
    this.addon.show(hwnd);
    this.visible = true;
    return true;
  }

  private finishMorph(ms: number) {
    this.clearHide();
    this.hideTimer = setTimeout(() => {
      this.morphing = false;
      this.shrinkTarget = null;
      this.addon.endMorph(); // net: the add-on reveals + drops the thumbnail itself
      this.hideNow();
    }, ms);
  }

  /**
   * maximize: a live DWM thumbnail of our window takes its place, the real window
   * resizes cloaked, and once it has painted at the new size the thumbnail grows from
   * the old rect to the new one (vsync-paced in the add-on); the window is revealed
   * exactly where it lands. on a snap drop the blur box stays under it, then goes.
   */
  morph(resize: () => void, ms: number = MORPH_MS) {
    const win = this.getMain();
    if (!win || win.isDestroyed()) return resize();
    const hwnd = win.getNativeWindowHandle();
    const from = this.addon.windowRect(hwnd);
    this.clearHide();
    if (!from || !this.surfaceFor(hwnd) || !this.addon.beginMorph(hwnd)) {
      resize();
      return;
    }
    this.morphing = true;
    try {
      resize();
    } finally {
      const to = this.addon.windowRect(hwnd) ?? from;
      this.addon.runMorph(from, to, ms, MORPH_EASE, true);
      this.finishMorph(ms + 200);
    }
  }

  /** dragging out of maximize: restore with a morph that follows the moving window */
  morphDragOut(resize: () => void) {
    this.morph(resize, DRAG_OUT_MS);
  }

  /** while a morph lands: aim it at the window's live position (it is being dragged) */
  followMorph() {
    if (!this.morphing) return;
    const win = this.getMain();
    if (!win || win.isDestroyed()) return;
    const r = this.addon.windowRect(win.getNativeWindowHandle());
    if (r) this.addon.setMorphTarget(r);
  }

  /**
   * restore: the snapshot of the full window shrinks to `target` (dip, re-read every
   * frame via followShrink, e.g. under a moving cursor) while the real window stays
   * as it is; only then `resize` puts it there, and it is revealed once painted.
   * the content never glitches mid-shrink because nothing resizes during it.
   */
  shrink(target: () => Rectangle | null, resize: () => void) {
    const win = this.getMain();
    if (!win || win.isDestroyed()) return resize();
    const hwnd = win.getNativeWindowHandle();
    const from = this.addon.windowRect(hwnd);
    const first = target();
    this.clearHide();
    if (!from || !first || !this.surfaceFor(hwnd) || !this.addon.beginMorph(hwnd)) {
      resize();
      return;
    }
    this.morphing = true;
    this.shrinkTarget = target;
    this.addon.runMorph(from, this.toPx(first), SHRINK_MS, MORPH_EASE, false);
    this.hideTimer = setTimeout(() => {
      this.shrinkTarget = null;
      try {
        resize();
      } finally {
        void afterPaint(win).then(() => {
          if (!this.morphing) return;
          const landed = this.addon.windowRect(hwnd);
          if (landed) this.addon.setMorphTarget(landed);
          this.addon.revealMorph();
          this.finishMorph(120);
        });
      }
    }, SHRINK_MS);
  }

  // the add-on surface on the monitor of `hwnd`, above everything (the transform
  // starts and ends on windows that are hidden at one end)
  private surfaceOnTop(hwnd: Buffer): boolean {
    if (this.visible) return true;
    const a = this.addon.placeOnWindowMonitor(hwnd);
    if (!a) return false;
    this.area = { x: a[0], y: a[1], w: a[2], h: a[3] };
    const empty: Edges = [0, 0, 0, 0];
    this.addon.animate(empty, empty, 0, GROW_EASE);
    this.anim = null;
    this.addon.show(null);
    this.visible = true;
    return true;
  }

  private containerStyle() {
    this.addon.setStyle(this.blur ? CONTAINER_TINT : 0xf8141416, Math.round(WINDOW_RADIUS_DIP * this.scale));
  }

  /**
   * main window -> overlay pill (minimize). container transform: the window's shape
   * glides into the pill and rounds into a capsule; its content fades out early, the
   * overlay's (prepared + painted hidden) fades in late, and the real overlay is
   * revealed exactly where the container lands. then the (hidden) window minimizes.
   */
  async toOverlay(
    openOverlay: (beforeShow: (win: BrowserWindow) => void) => Promise<BrowserWindow | null>,
    minimize: () => void,
  ) {
    const win = this.getMain();
    if (!win || win.isDestroyed()) return minimize();
    const hwnd = win.getNativeWindowHandle();
    const from = this.addon.windowRect(hwnd);
    if (!from) return minimize();
    this.clearHide();
    let freshOverlay = false;
    const overlay = await openOverlay((ov) => {
      this.addon.cloak(ov.getNativeWindowHandle(), true);
      freshOverlay = !ov.isVisible() && ov.webContents.isLoading();
    });
    if (!overlay || overlay.isDestroyed()) return minimize();
    const ovHwnd = overlay.getNativeWindowHandle();
    // already loaded (prewarmed): it paints within the transform's first frames anyway,
    // and its content only fades in from a quarter of the way, so don't wait for it
    if (freshOverlay) await afterPaint(overlay);
    const to = this.addon.windowRect(ovHwnd);
    if (!to || !this.surfaceOnTop(hwnd)) {
      this.addon.cloak(ovHwnd, false);
      return minimize();
    }
    this.containerStyle();
    const pillRadius = (to[3] - to[1]) / 2;
    const ok = this.addon.transform(
      from,
      to,
      TO_OVERLAY_MS,
      EMPHASIZED,
      Math.round(WINDOW_RADIUS_DIP * this.scale),
      pillRadius,
      hwnd,
      ovHwnd,
    );
    if (!ok) {
      this.addon.cloak(ovHwnd, false);
      this.hideNow();
      return minimize();
    }
    this.morphing = true;
    this.hideTimer = setTimeout(() => {
      try {
        this.minimizeKeepingPreview(hwnd, minimize);
      } finally {
        this.addon.cloak(ovHwnd, false);
        this.finishMorph(60);
      }
    }, TO_OVERLAY_MS + 40);
  }

  private minimizeKeepingPreview(hwnd: Buffer, minimize: () => void) {
    const setTransitionsDisabled = this.addon.setTransitionsDisabled?.bind(this.addon);
    if (this.addon.minimizeKeepingPreview && setTransitionsDisabled) {
      this.addon.minimizeKeepingPreview(hwnd);
      this.addon.armRestoreTrap?.(hwnd, true);
      setTimeout(() => setTransitionsDisabled(hwnd, false), TRANSITIONS_RESTORE_MS);
      return;
    }
    if (!setTransitionsDisabled) {
      minimize();
      setTimeout(() => this.addon.cloak(hwnd, false), 150);
      return;
    }
    setTransitionsDisabled(hwnd, true);
    this.addon.cloak(hwnd, false);
    minimize();
    setTimeout(() => setTransitionsDisabled(hwnd, false), TRANSITIONS_RESTORE_MS);
  }

  /**
   * overlay pill -> main window (F in the overlay): the exact reverse. the window is
   * restored hidden and painted first; the pill swells into it, the overlay content
   * fades out early, the app fades in late, and the window is revealed where it lands.
   */
  takeRestoredCloaked(): boolean {
    return this.addon.takeRestoredCloaked?.() ?? false;
  }

  disarmRestoreTrap() {
    const win = this.getMain();
    if (win && !win.isDestroyed()) this.addon.armRestoreTrap?.(win.getNativeWindowHandle(), false);
  }

  async fromOverlay(
    overlay: BrowserWindow | null,
    restore: () => void,
    closeOverlay: () => void,
    alreadyRestored = false,
  ) {
    const win = this.getMain();
    const uncloakedRestore = () => {
      if (!alreadyRestored) return restore();
      if (win && !win.isDestroyed()) this.addon.cloak(win.getNativeWindowHandle(), false);
      closeOverlay();
    };
    if (!win || win.isDestroyed() || !overlay || overlay.isDestroyed() || !overlay.isVisible()) {
      uncloakedRestore();
      return;
    }
    const hwnd = win.getNativeWindowHandle();
    const ovHwnd = overlay.getNativeWindowHandle();
    const from = this.addon.windowRect(ovHwnd);
    if (!from) return uncloakedRestore();
    this.addon.armRestoreTrap?.(hwnd, false);
    this.clearHide();
    this.addon.cloak(hwnd, true);
    if (!alreadyRestored) restore();
    await afterPaint(win);
    const to = this.addon.windowRect(hwnd);
    if (!to || !this.surfaceOnTop(hwnd)) {
      this.addon.cloak(hwnd, false);
      return;
    }
    this.containerStyle();
    const ok = this.addon.transform(
      from,
      to,
      FROM_OVERLAY_MS,
      EMPHASIZED,
      (from[3] - from[1]) / 2,
      Math.round(WINDOW_RADIUS_DIP * this.scale),
      ovHwnd,
      hwnd,
    );
    if (!ok) {
      this.addon.cloak(hwnd, false);
      this.hideNow();
      closeOverlay();
      return;
    }
    this.morphing = true;
    this.hideTimer = setTimeout(() => {
      this.addon.cloak(hwnd, false); // in case the add-on didn't get to it
      closeOverlay(); // the overlay is hidden (cloaked): close it unseen, then uncloak it
      setTimeout(() => {
        if (!overlay.isDestroyed()) this.addon.cloak(ovHwnd, false);
      }, 250);
      this.finishMorph(60);
    }, FROM_OVERLAY_MS + 40);
  }

  /** a shrink is in flight (its window hasn't been resized yet) */
  get shrinking() {
    return this.shrinkTarget !== null;
  }

  private shrinkTarget: (() => Rectangle | null) | null = null;

  private toPx(rectDip: Rectangle): Edges {
    const win = this.getMain();
    const px = screen.dipToScreenRect(win && !win.isDestroyed() ? win : null, rectDip);
    return [px.x, px.y, px.x + px.width, px.y + px.height];
  }

  /** while shrinking under a dragged cursor: aim at where the window will land */
  followShrink() {
    if (!this.shrinkTarget) return;
    const t = this.shrinkTarget();
    if (t) this.addon.setMorphTarget(this.toPx(t));
  }

  hideNow() {
    this.clearHide();
    this.morphing = false;
    this.shrinkTarget = null;
    this.anim = null;
    if (this.visible) this.addon.hide();
    this.visible = false;
  }

  destroy() {
    this.hideNow();
    try {
      this.addon.endTransform();
      this.addon.endMorph();
    } catch {
      // nothing to end
    }
    try {
      this.addon.destroy();
    } catch {
      // already gone
    }
  }
}
