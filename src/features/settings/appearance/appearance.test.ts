import { describe, it, expect } from "vitest";
import {
  accentVars,
  glassVars,
  presetById,
  readableDim,
  rgbStringToHex,
  themeCss,
  THEME_PRESETS,
} from "./themePresets";
import {
  DEFAULT_APPEARANCE,
  fromLegacyCustomization,
  sanitizeAppearance,
} from "./appearanceStore";
import { exportThemeFile, parseThemeFile } from "./themeFile";
import { renderScale } from "./backdropRender";

const luminanceOf = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

describe("theme presets", () => {
  it("has unique ids and falls back to the default", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(presetById("nope").id).toBe("default");
  });

  it("writes css only for the modes a preset touches", () => {
    const css = themeCss({ dark: { "--bg-canvas": "#000000" }, light: {} });
    expect(css).toContain('html:root[data-theme="dark"]');
    expect(css).toContain("--bg-canvas: #000000;");
    expect(css).not.toContain('data-theme="light"');
    expect(themeCss({ dark: {}, light: {} })).toBe("");
  });

  it("keeps a dark accent visible on dark backgrounds", () => {
    const vars = accentVars("#1a0033", true);
    expect(luminanceOf(vars["--accent-primary"]!)).toBeGreaterThan(0.1);
  });

  it("keeps a pale accent visible on light backgrounds", () => {
    const vars = accentVars("#ffeef5", false);
    expect(luminanceOf(vars["--accent-primary"]!)).toBeLessThan(0.4);
  });

  it("orders the accent shades from base to lightest", () => {
    const vars = accentVars("#3d5afe", true);
    const [a, b, c] = [
      vars["--accent-primary"]!,
      vars["--accent-secondary"]!,
      vars["--accent-tertiary"]!,
    ].map(luminanceOf);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("parses cover colours", () => {
    expect(rgbStringToHex("rgb(255, 0, 16)")).toBe("#ff0010");
    expect(rgbStringToHex("nope")).toBeNull();
  });

  it("tints glass by mode", () => {
    expect(glassVars(0.5, 20, true)["--bg-glass"]).toBe(
      "rgba(18, 18, 20, 0.50)",
    );
    expect(glassVars(2, 20, false)["--bg-glass"]).toBe(
      "rgba(255, 255, 255, 0.90)",
    );
  });
});

describe("readable dim", () => {
  it("needs nothing for dark pictures in dark mode", () => {
    expect(readableDim(0.05, true)).toBe(0);
  });

  it("darkens bright pictures enough for white text", () => {
    const dim = readableDim(0.8, true);
    expect(0.8 * (1 - dim)).toBeCloseTo(0.16, 5);
  });

  it("lightens dark pictures enough for dark text", () => {
    const dim = readableDim(0.1, false);
    expect(0.1 + (1 - 0.1) * dim).toBeCloseTo(0.6, 5);
  });

  it("never asks for more than the slider allows", () => {
    expect(readableDim(1, true)).toBeLessThanOrEqual(0.85);
    expect(readableDim(0, false)).toBeLessThanOrEqual(0.85);
  });
});

describe("appearance settings", () => {
  it("clamps and rejects bad values", () => {
    const clean = sanitizeAppearance({
      preset: "nope",
      accent: "red",
      blur: 400,
      dim: -1,
      saturation: Number.NaN,
      wallpaperKey: "../../etc",
    });
    expect(clean.preset).toBe("default");
    expect(clean.accent).toBe("default");
    expect(clean.blur).toBe(40);
    expect(clean.dim).toBe(0);
    expect(clean.saturation).toBe(DEFAULT_APPEARANCE.saturation);
    expect(clean.wallpaperKey).toBeNull();
  });

  it("accepts hex accents and gallery keys", () => {
    const clean = sanitizeAppearance({
      accent: "#a1B2c3",
      wallpaperKey: "0123456789abcdef0123",
      wallpaperKind: "video",
    });
    expect(clean.accent).toBe("#a1B2c3");
    expect(clean.wallpaperKey).toBe("0123456789abcdef0123");
    expect(clean.wallpaperKind).toBe("video");
  });

  it("brings back blur and dim from the old customization store", () => {
    expect(
      fromLegacyCustomization({
        state: { backgroundBlur: 12, backgroundDim: 40 },
      }),
    ).toEqual({ blur: 12, dim: 0.4 });
    expect(fromLegacyCustomization({ state: { backgroundBlur: 0 } })).toEqual(
      {},
    );
    expect(fromLegacyCustomization(null)).toEqual({});
  });
});

describe("theme files", () => {
  it("round-trips the shareable settings and never the wallpaper", () => {
    const text = exportThemeFile(
      {
        ...DEFAULT_APPEARANCE,
        preset: "nord",
        accent: "#88c0d0",
        blur: 12,
        wallpaperKey: "0123456789abcdef0123",
        wallpaperKind: "image",
      },
      "Frosty",
    );
    expect(text).not.toContain("0123456789abcdef0123");
    const parsed = parseThemeFile(text);
    expect(parsed).toMatchObject({
      ok: true,
      name: "Frosty",
      settings: { preset: "nord", accent: "#88c0d0", blur: 12 },
    });
  });

  it.each([
    ["garbage", "{nope", "not-json"],
    ["another app's json", '{"theme":"x"}', "not-a-theme"],
    [
      "a newer format",
      '{"liner":"theme","version":2,"settings":{}}',
      "newer-version",
    ],
    [
      "unknown keys",
      '{"liner":"theme","version":1,"settings":{"wallpaperKey":"x"}}',
      "invalid",
    ],
    [
      "wrong types",
      '{"liner":"theme","version":1,"settings":{"blur":"lots"}}',
      "invalid",
    ],
    [
      "out-of-range values",
      '{"liner":"theme","version":1,"settings":{"dim":5}}',
      "invalid",
    ],
    [
      "css in a colour",
      '{"liner":"theme","version":1,"settings":{"accent":"red;}body{display:none"}}',
      "invalid",
    ],
  ])("refuses %s", (_name, text, error) => {
    expect(parseThemeFile(text)).toEqual({ ok: false, error });
  });
});

describe("baked blur", () => {
  it("renders smaller the more it blurs, within limits", () => {
    expect(renderScale(0)).toBe(1);
    expect(renderScale(12)).toBeCloseTo(0.5);
    expect(renderScale(40)).toBeCloseTo(0.15);
    expect(renderScale(400)).toBe(0.12);
  });
});
