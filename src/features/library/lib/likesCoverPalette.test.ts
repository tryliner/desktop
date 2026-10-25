import { describe, expect, it } from "vitest";
import {
  buildAccentBackdropSvg,
  buildLikesCoverSvg,
  buildLightLikesCoverSvg,
  svgToDataUrl,
  toneFromPixels,
  vividness,
} from "./likesCoverPalette";

function solid(r: number, g: number, b: number, count = 16): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) data.set([r, g, b, 255], i * 4);
  return data;
}

const orange = { color1: "rgb(120, 60, 20)", color2: "rgb(240, 140, 40)", logoColor: "rgb(255, 240, 220)" };

describe("wallpaper tone", () => {
  it("rates a dark wallpaper as not vivid", () => {
    expect(vividness(toneFromPixels(solid(15, 15, 18)))).toBe(0);
  });

  it("rates a bright orange wallpaper as vivid", () => {
    expect(vividness(toneFromPixels(solid(235, 140, 50)))).toBeGreaterThan(0.6);
  });

  it("keeps a bright grey wallpaper muted", () => {
    const grey = vividness(toneFromPixels(solid(200, 200, 200)));
    const color = vividness(toneFromPixels(solid(235, 140, 50)));
    expect(grey).toBeLessThan(color);
  });

  it("lifts the cover base on a vivid wallpaper", () => {
    const dark = buildLikesCoverSvg(orange, toneFromPixels(solid(15, 15, 18)));
    const vivid = buildLikesCoverSvg(orange, toneFromPixels(solid(235, 140, 50)));
    expect(dark).toContain('fill="black" fill-opacity="0.45"');
    expect(vivid).not.toContain('fill-opacity="0.45"');
  });
});

describe("buildLikesCoverSvg", () => {
  it("swaps every stock purple for wallpaper tones", () => {
    const svg = buildLikesCoverSvg({
      color1: "rgb(20, 60, 30)",
      color2: "rgb(60, 200, 90)",
      logoColor: "rgb(230, 250, 235)",
    });

    for (const stock of ["#111224", "#433277", "#4D71FF", "#7A4DFF", "#534DFF"]) {
      expect(svg).not.toContain(stock);
    }
    expect(svg).toContain("<svg");
    expect(svg.match(/#[0-9a-f]{6}/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("builds a pastel light variant with a brighter heart", () => {
    const svg = buildLightLikesCoverSvg();

    expect(svg).not.toContain("#111224");
    expect(svg).not.toContain('fill="black" fill-opacity="0.2"');
    expect(svg).toContain('fill="white" fill-opacity="0.92"');
  });

  it("encodes into a loadable data url", () => {
    expect(svgToDataUrl("<svg/>")).toBe("data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E");
  });
});

describe("buildAccentBackdropSvg", () => {
  function lightness(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  }

  it("is the library artwork with only its hue moved to the cover accent", () => {
    const svg = buildAccentBackdropSvg(orange);
    expect(svg).toContain('fill="white" fill-opacity="0.7"');
    for (const stock of ["#111224", "#433277", "#4D71FF", "#7A4DFF", "#534DFF"]) {
      expect(svg).not.toContain(stock);
    }
    const inner = svg.match(/stop-color="(#[0-9a-f]{6})"/)?.[1];
    expect(inner).toBeDefined();
    expect(lightness(inner!)).toBeCloseTo(lightness("#111224"), 1);
  });
});
