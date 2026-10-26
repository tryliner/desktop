import { describe, expect, it } from "vitest";
import { computeDragBounds, cubicBezier, isInTopSnapZone, lerpEdges, restoreUnderCursor, toEdges } from "./window-drag";

describe("computeDragBounds", () => {
  const start = { x: 100, y: 50, width: 1200, height: 780 };

  it("moves by the cursor travel", () => {
    expect(computeDragBounds(start, { x: 10, y: 10 }, { x: 35, y: -5 })).toEqual({
      x: 125,
      y: 35,
      width: 1200,
      height: 780,
    });
  });

  it("never changes the size, however long the drag", () => {
    let cursor = { x: 0, y: 0 };
    for (let i = 0; i < 5000; i++) {
      cursor = { x: cursor.x + ((i % 7) - 3) * 1.25, y: cursor.y + ((i % 5) - 2) * 1.5 };
      const b = computeDragBounds(start, { x: 0, y: 0 }, cursor);
      expect(b.width).toBe(1200);
      expect(b.height).toBe(780);
    }
  });

  it("rounds fractional positions to whole pixels", () => {
    const b = computeDragBounds(start, { x: 0, y: 0 }, { x: 0.6, y: 0.4 });
    expect([b.x, b.y]).toEqual([101, 50]);
  });
});

describe("isInTopSnapZone", () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 };

  it("arms on the top edge", () => {
    expect(isInTopSnapZone({ x: 900, y: 0 }, display)).toBe(true);
    expect(isInTopSnapZone({ x: 900, y: 2 }, display)).toBe(true);
  });

  it("stays off below the edge", () => {
    expect(isInTopSnapZone({ x: 900, y: 3 }, display)).toBe(false);
    expect(isInTopSnapZone({ x: 900, y: 400 }, display)).toBe(false);
  });

  it("only counts the display the cursor is on", () => {
    const second = { x: 1920, y: 200, width: 1920, height: 1080 };
    expect(isInTopSnapZone({ x: 2500, y: 200 }, second)).toBe(true);
    expect(isInTopSnapZone({ x: 900, y: 0 }, second)).toBe(false);
  });
});

describe("restoreUnderCursor", () => {
  const maximized = { x: 0, y: 0, width: 1920, height: 1040 };
  const size = { width: 1200, height: 780 };

  it("keeps the cursor at the same relative x", () => {
    const r = restoreUnderCursor(maximized, size, { x: 960, y: 12 });
    expect(r).toEqual({ x: 360, y: 0, width: 1200, height: 780 });
  });

  it("works at the far right", () => {
    const r = restoreUnderCursor(maximized, size, { x: 1920, y: 12 });
    expect(r.x + r.width).toBe(1920);
  });

  it("clamps the vertical offset into the restored height", () => {
    const r = restoreUnderCursor(maximized, { width: 400, height: 300 }, { x: 960, y: 900 });
    expect(r.y).toBe(900 - 299);
  });
});

describe("snap preview geometry", () => {
  it("converts rects to edges and interpolates them", () => {
    const a = toEdges({ x: 10, y: 20, width: 100, height: 50 });
    expect(a).toEqual([10, 20, 110, 70]);
    expect(lerpEdges(a, [0, 0, 200, 100], 0.5)).toEqual([5, 10, 155, 85]);
  });

  it("cubicBezier matches the endpoints and the linear curve", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0)).toBe(0);
    expect(linear(1)).toBe(1);
    expect(linear(0.37)).toBeCloseTo(0.37, 4);
  });

  it("cubicBezier ease-out is ahead of linear and monotonic", () => {
    const easeOut = cubicBezier(0.33, 1, 0.68, 1);
    let prev = 0;
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      const v = easeOut(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      if (t < 1) expect(v).toBeGreaterThan(t);
      prev = v;
    }
  });
});
