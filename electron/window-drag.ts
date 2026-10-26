// Manual window move (windows/macos; linux uses css app-region).
//
// Electron's setPosition() on Windows converts DIP -> physical pixels and back
// on every call. With display scaling (125%, 150%, ...) or when crossing
// monitors with different DPI, that rounding nudges the window SIZE by a pixel
// now and then, so a long drag slowly grows the window. Moving with
// setBounds() and the size captured at drag start pins the size exactly.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** bounds for the current cursor: start position + cursor travel, start size kept */
export function computeDragBounds(start: Rect, startCursor: Point, cursor: Point): Rect {
  return {
    x: Math.round(start.x + (cursor.x - startCursor.x)),
    y: Math.round(start.y + (cursor.y - startCursor.y)),
    width: start.width,
    height: start.height,
  };
}

// drag-to-top snap (windows). the custom drag never reaches the os, so aero snap
// is emulated: cursor on the top edge of a display -> show the preview, drop -> maximize

/** px band at the top of the display that arms the maximize snap */
export const TOP_SNAP_THRESHOLD = 2;

/** true when the cursor sits on the top edge of the display it is on */
export function isInTopSnapZone(cursor: Point, displayBounds: Rect, threshold = TOP_SNAP_THRESHOLD): boolean {
  return (
    cursor.x >= displayBounds.x &&
    cursor.x < displayBounds.x + displayBounds.width &&
    cursor.y <= displayBounds.y + threshold
  );
}

/**
 * where a maximized window lands when the user drags it out: restored size, placed
 * so the cursor keeps the same relative x across the title bar and the same
 * distance from the top (clamped into the restored height), like windows does
 */
export function restoreUnderCursor(maximized: Rect, restoredSize: { width: number; height: number }, cursor: Point): Rect {
  const ratio = maximized.width > 0 ? (cursor.x - maximized.x) / maximized.width : 0.5;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const offsetY = Math.min(Math.max(0, cursor.y - maximized.y), Math.max(0, restoredSize.height - 1));
  return {
    x: Math.round(cursor.x - restoredSize.width * clampedRatio),
    y: Math.round(cursor.y - offsetY),
    width: restoredSize.width,
    height: restoredSize.height,
  };
}

// ---- snap preview geometry (shared by the native compositor preview) ----

/** [left, top, right, bottom] */
export type Edges = [number, number, number, number];

export const toEdges = (r: Rect): Edges => [r.x, r.y, r.x + r.width, r.y + r.height];

export const lerpEdges = (a: Edges, b: Edges, t: number): Edges => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
];

/**
 * css-style cubic-bezier easing (x1, y1, x2, y2). same curve the compositor plays,
 * so main can tell where a running animation is (to turn it around smoothly)
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // newton, then bisection as a fallback
    let u = t;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(u) - t;
      if (Math.abs(err) < 1e-6) return sampleY(u);
      const d = slopeX(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0;
    let hi = 1;
    u = t;
    for (let i = 0; i < 30; i++) {
      const x = sampleX(u);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return sampleY(u);
  };
}
