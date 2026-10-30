import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  effectiveZoom,
  maxZoomFor,
  nextZoomFactor,
  zoomActionFor,
} from "./zoom";

const key = (
  key: string,
  extra: Partial<Parameters<typeof zoomActionFor>[0]> = {},
) => ({
  type: "keyDown" as const,
  key,
  code: "",
  control: true,
  meta: false,
  alt: false,
  ...extra,
});

describe("zoom shortcuts", () => {
  it("zooms in with Ctrl+= as well as Ctrl+Shift+= and the numpad", () => {
    expect(zoomActionFor(key("="))).toBe("in");
    expect(zoomActionFor(key("+"))).toBe("in");
    expect(zoomActionFor(key("", { code: "NumpadAdd" }))).toBe("in");
  });

  it("zooms out, resets, and ignores keys without Ctrl or with Alt", () => {
    expect(zoomActionFor(key("-"))).toBe("out");
    expect(zoomActionFor(key("0"))).toBe("reset");
    expect(zoomActionFor(key("=", { control: false }))).toBeNull();
    expect(zoomActionFor(key("=", { alt: true }))).toBeNull();
    expect(zoomActionFor(key("=", { type: "keyUp" }))).toBeNull();
  });

  it("stays between the minimum and what the window can fit", () => {
    expect(nextZoomFactor(MIN_ZOOM, "out", MAX_ZOOM)).toBe(MIN_ZOOM);
    expect(nextZoomFactor(1, "in", 1.2)).toBe(1.1);
    expect(nextZoomFactor(1.2, "in", 1.2)).toBe(1.2);
    expect(nextZoomFactor(0.8, "reset", MAX_ZOOM)).toBe(1);
  });

  it("never zooms in past the layout's minimum size", () => {
    expect(maxZoomFor(1100, 705, 1100, 705)).toBe(1);
    expect(maxZoomFor(1440, 900, 1100, 705)).toBe(1.2);
    expect(maxZoomFor(3840, 2160, 1100, 705)).toBe(MAX_ZOOM);
  });

  it("shrinks below 1 when the work area is smaller than the layout", () => {
    // 1920x1080 at 150% scaling with a taskbar: ~1280x672 of work area
    expect(maxZoomFor(1280, 672, 1100, 705)).toBe(0.9);
    // 1366x768 at 125%: ~1093x582
    expect(maxZoomFor(1093, 582, 1100, 705)).toBe(MIN_ZOOM);
    expect(maxZoomFor(640, 400, 1100, 705)).toBe(MIN_ZOOM);
  });
});

describe("effective zoom", () => {
  it("caps the user's zoom by what the window fits and restores it when it grows", () => {
    expect(effectiveZoom(1, 0.9)).toBe(0.9);
    expect(effectiveZoom(1.2, 0.9)).toBe(0.9);
    expect(effectiveZoom(1.2, 1.5)).toBe(1.2);
    expect(effectiveZoom(0.8, 1.5)).toBe(0.8);
  });
});
