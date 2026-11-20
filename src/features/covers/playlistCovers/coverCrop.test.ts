import { describe, it, expect } from "vitest";
import { clampOffset, cropRect, zoomAround, clampZoom } from "./coverCrop";

const wide = { width: 2000, height: 1000 };
const tall = { width: 800, height: 1600 };

describe("cover crop", () => {
  it("centres a square of the shorter side at zoom 1", () => {
    expect(cropRect(wide, 300, 1, { x: 0, y: 0 })).toEqual({
      x: 500,
      y: 0,
      size: 1000,
    });
    expect(cropRect(tall, 300, 1, { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 400,
      size: 800,
    });
  });

  it("shrinks the source square as you zoom in", () => {
    const rect = cropRect(wide, 300, 2, { x: 0, y: 0 });
    expect(rect.size).toBe(500);
    expect(rect.x).toBe(750);
    expect(rect.y).toBe(250);
  });

  it("dragging right shows more of the left side", () => {
    const rect = cropRect(wide, 300, 1, { x: 150, y: 0 });
    expect(rect.x).toBe(0);
  });

  it("never lets the image leave empty corners", () => {
    expect(clampOffset(wide, 300, 1, { x: 9999, y: 50 })).toEqual({
      x: 150,
      y: 0,
    });
    const rect = cropRect(wide, 300, 1, { x: -9999, y: 9999 });
    expect(rect.x + rect.size).toBe(2000);
    expect(rect.y).toBe(0);
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const viewport = 300;
    const anchor = { x: 250, y: 150 };
    const before = cropRect(wide, viewport, 1, { x: 0, y: 0 });
    const sourceUnderCursor = before.x + (anchor.x / viewport) * before.size;
    const { zoom, offset } = zoomAround(
      wide,
      viewport,
      1,
      { x: 0, y: 0 },
      2,
      anchor,
    );
    const after = cropRect(wide, viewport, zoom, offset);
    const stillUnder = after.x + (anchor.x / viewport) * after.size;
    expect(stillUnder).toBeCloseTo(sourceUnderCursor, 5);
  });

  it("clamps zoom to the allowed range", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(10)).toBe(4);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});
