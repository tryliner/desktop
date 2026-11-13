import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  effectiveZoom,
  maxZoomFor,
  nextZoomFactor,
  normalizeZoom,
  sizeForZoom,
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

describe("normalizeZoom", () => {
  it("rounds to a tenth and clamps to the allowed range", () => {
    expect(normalizeZoom(1.14)).toBe(1.1);
    expect(normalizeZoom(0.2)).toBe(MIN_ZOOM);
    expect(normalizeZoom(9)).toBe(MAX_ZOOM);
  });

  it("rejects values that are not finite numbers", () => {
    expect(normalizeZoom("1.2")).toBeNull();
    expect(normalizeZoom(Number.NaN)).toBeNull();
    expect(normalizeZoom(undefined)).toBeNull();
  });
});

describe("sizeForZoom", () => {
  const area = { width: 1920, height: 1040 };

  it("grows the window so the scaled layout still fits", () => {
    expect(sizeForZoom([1100, 705], 1.2, 1100, 705, area)).toEqual([1320, 846]);
  });

  it("keeps a window that is already big enough", () => {
    expect(sizeForZoom([1600, 900], 1.1, 1100, 705, area)).toEqual([1600, 900]);
  });

  it("never grows past the work area", () => {
    expect(sizeForZoom([1100, 705], 1.5, 1100, 705, area)).toEqual([
      1650, 1040,
    ]);
  });
});
