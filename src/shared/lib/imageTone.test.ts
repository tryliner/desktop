import { describe, expect, it } from "vitest";
import { hueRarity, pickStrikingIndex, strikingness, toneFromPixels } from "./imageTone";

function pixels(...groups: [number, number, number, number][]): Uint8ClampedArray {
  const total = groups.reduce((sum, [, , , count]) => sum + count, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [r, g, b, count] of groups) {
    for (let n = 0; n < count; n++, i++) data.set([r, g, b, 255], i * 4);
  }
  return data;
}

const grey = toneFromPixels(pixels([130, 125, 120, 16]));
const brightPink = toneFromPixels(pixels([230, 80, 160, 16]));
const mutedPink = toneFromPixels(pixels([200, 95, 135, 10], [30, 25, 28, 6]));
const mustard = toneFromPixels(pixels([215, 175, 45, 16]));
const black = toneFromPixels(pixels([12, 12, 14, 16]));

describe("hueRarity", () => {
  it("favours pink and purple over warm yellows", () => {
    expect(hueRarity(0.9)).toBeGreaterThan(hueRarity(0.12));
    expect(hueRarity(0.6)).toBeGreaterThan(hueRarity(0.12));
  });
});

describe("strikingness", () => {
  it("rates plain mid grey low", () => {
    expect(strikingness(grey)).toBeLessThan(0.2);
  });

  it("rates a vivid pink and a near black cover high", () => {
    expect(strikingness(brightPink)).toBeGreaterThan(0.8);
    expect(strikingness(black)).toBeGreaterThan(0.8);
  });

  it("reads the dominant hue of the cover", () => {
    expect(mutedPink.hue).toBeGreaterThan(0.85);
    expect(mustard.hue).toBeLessThan(0.17);
  });
});

describe("pickStrikingIndex", () => {
  it("picks a softer pink over a strong mustard cover", () => {
    expect(pickStrikingIndex([grey, grey, mutedPink, mustard])).toBe(2);
  });

  it("falls back to the first cover until tones are known", () => {
    expect(pickStrikingIndex([undefined, undefined])).toBe(0);
  });
});
