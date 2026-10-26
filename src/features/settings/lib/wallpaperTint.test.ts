import { describe, expect, it } from "vitest";
import { toneFromPixels } from "@/shared/lib/imageTone";
import { wallpaperAccent, wallpaperFade } from "./wallpaperTint";

function solid(r: number, g: number, b: number, count = 16): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) data.set([r, g, b, 255], i * 4);
  return data;
}

function channels(rgb: string): number[] {
  return rgb.split(",").map((part) => Number(part.trim()));
}

const orange = { color1: "rgb(120, 60, 20)", color2: "rgb(240, 140, 40)", logoColor: "rgb(255, 240, 220)" };

describe("wallpaperAccent", () => {
  it("stays near black on a dark wallpaper", () => {
    const [r, g, b] = channels(wallpaperAccent(orange, toneFromPixels(solid(15, 15, 18))));
    expect(Math.max(r!, g!, b!)).toBeLessThan(24);
  });

  it("picks up the wallpaper hue on a colourful wallpaper", () => {
    const [r, g, b] = channels(wallpaperAccent(orange, toneFromPixels(solid(235, 140, 50))));
    expect(r!).toBeGreaterThan(b! + 30);
    expect(r!).toBeGreaterThan(g!);
  });
});

describe("wallpaperFade", () => {
  it("lets the image show at the top and ends in the solid accent at the bottom", () => {
    const fade = wallpaperFade("68, 64, 28");
    expect(fade).toContain("rgba(68, 64, 28, 0.2) 0%");
    expect(fade).toContain("rgb(68, 64, 28) 100%");
  });
});
