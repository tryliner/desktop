import { describe, expect, it } from "vitest";
import { fullscreenColumnScale } from "./fullscreenScale";

describe("fullscreenColumnScale", () => {
  it("keeps the normal size when the screen has no room to grow", () => {
    expect(fullscreenColumnScale(1000, 700)).toBe(1);
  });

  it("grows the cover on a big fullscreen display", () => {
    const scale = fullscreenColumnScale(1920, 1080);
    expect(scale).toBeGreaterThan(1.5);
    expect(scale).toBeLessThanOrEqual(1.6);
  });

  it("never grows past the cap on huge screens", () => {
    expect(fullscreenColumnScale(3840, 2160)).toBe(1.6);
  });

  it("is limited by height on wide but short windows", () => {
    expect(fullscreenColumnScale(2560, 700)).toBeCloseTo(1.06, 2);
  });
});
