import { describe, it, expect } from "vitest";
import { glassVars, readableDim, rootVarsCss } from "./wallpaperCss";
import { renderScale } from "./backdropRender";

describe("wallpaper css", () => {
  it("writes only the modes that have variables", () => {
    const css = rootVarsCss({ dark: { "--bg-glass": "red" }, light: {} });
    expect(css).toContain('html:root[data-theme="dark"]');
    expect(css).toContain("--bg-glass: red !important;");
    expect(css).not.toContain('data-theme="light"');
    expect(rootVarsCss({ dark: {}, light: {} })).toBe("");
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

describe("baked blur", () => {
  it("renders smaller the more it blurs, within limits", () => {
    expect(renderScale(0)).toBe(1);
    expect(renderScale(12)).toBeCloseTo(0.5);
    expect(renderScale(40)).toBeCloseTo(0.15);
    expect(renderScale(400)).toBe(0.12);
  });
});
