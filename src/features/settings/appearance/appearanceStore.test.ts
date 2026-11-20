import { describe, it, expect } from "vitest";
import {
  DEFAULT_APPEARANCE,
  fromLegacyCustomization,
  sanitizeAppearance,
} from "./appearanceStore";

describe("appearance settings", () => {
  it("clamps and rejects bad values", () => {
    const clean = sanitizeAppearance({
      blur: 400,
      dim: -1,
      saturation: Number.NaN,
      wallpaperKey: "../../etc",
    });
    expect(clean.blur).toBe(40);
    expect(clean.dim).toBe(0);
    expect(clean.saturation).toBe(DEFAULT_APPEARANCE.saturation);
    expect(clean.wallpaperKey).toBeNull();
  });

  it("accepts gallery keys", () => {
    const clean = sanitizeAppearance({
      wallpaperKey: "0123456789abcdef0123",
      wallpaperKind: "video",
    });
    expect(clean.wallpaperKey).toBe("0123456789abcdef0123");
    expect(clean.wallpaperKind).toBe("video");
  });

  it("drops settings from the removed colour themes", () => {
    const clean = sanitizeAppearance({ blur: 10 });
    expect(Object.keys(clean)).not.toContain("preset");
    expect(Object.keys(clean)).not.toContain("accent");
  });

  it("brings back blur and dim from the old customization store", () => {
    expect(
      fromLegacyCustomization({
        state: { backgroundBlur: 12, backgroundDim: 40 },
      }),
    ).toEqual({ blur: 12, dim: 0.4 });
    expect(fromLegacyCustomization(null)).toEqual({});
  });

  it("keeps an old blur or dim of zero", () => {
    expect(
      fromLegacyCustomization({
        state: { backgroundBlur: 0, backgroundDim: 0 },
      }),
    ).toEqual({ blur: 0, dim: 0 });
  });
});
