import { describe, expect, it } from "vitest";
import {
  EQ_BAND_COUNT,
  EQ_FREQUENCIES,
  EQ_PRESETS,
  EQ_PRESET_IDS,
  autoPreampDb,
  clampBandDb,
  formatBandFrequency,
  formatDb,
  normalizeBands,
  presetForBands,
  responseDb,
} from "./eqMath";

const flat = () => new Array(EQ_BAND_COUNT).fill(0);

describe("eq maths", () => {
  it("every preset has one value per band, within range", () => {
    for (const id of EQ_PRESET_IDS) {
      expect(EQ_PRESETS[id]).toHaveLength(EQ_BAND_COUNT);
      for (const v of EQ_PRESETS[id]) expect(Math.abs(v)).toBeLessThanOrEqual(12);
    }
  });

  it("a flat EQ is exactly unity everywhere", () => {
    expect(responseDb(flat(), 1000)).toBe(0);
    expect(autoPreampDb(flat())).toBe(0);
  });

  it("a peaking band hits its gain at its centre frequency", () => {
    const bands = flat();
    bands[5] = 6; // 1 kHz
    expect(responseDb(bands, 1000)).toBeCloseTo(6, 1);
    expect(Math.abs(responseDb(bands, 16000))).toBeLessThan(0.3);
  });

  it("edge bands hit their gain at their own frequency (dots sit on the curve)", () => {
    const low = flat();
    low[0] = 8;
    expect(responseDb(low, 32)).toBeCloseTo(8, 1);
    expect(Math.abs(responseDb(low, 5000))).toBeLessThan(0.2);
    const high = flat();
    high[9] = 8;
    expect(responseDb(high, 16000)).toBeCloseTo(8, 1);
  });

  it("auto preamp cancels the highest peak and never boosts", () => {
    const bands = [...EQ_PRESETS.bass_boost];
    const pre = autoPreampDb(bands);
    expect(pre).toBeLessThan(0);
    let peak = -Infinity;
    for (let f = 20; f <= 20000; f *= 1.05) peak = Math.max(peak, responseDb(bands, f) + pre);
    expect(peak).toBeLessThan(0.3);
    expect(autoPreampDb([...EQ_PRESETS.bass_cut])).toBe(0);
  });

  it("recognises presets and falls back to custom", () => {
    expect(presetForBands(flat())).toBe("flat");
    expect(presetForBands([...EQ_PRESETS.rock])).toBe("rock");
    const tweaked = [...EQ_PRESETS.rock];
    tweaked[3] += 0.5;
    expect(presetForBands(tweaked)).toBe("custom");
  });

  it("clamps and steps band values, and sanitises stored arrays", () => {
    expect(clampBandDb(20)).toBe(12);
    expect(clampBandDb(-3.26)).toBe(-3.5);
    expect(clampBandDb(NaN)).toBe(0);
    expect(normalizeBands([1, "x", 30])).toEqual([1, 0, 12, 0, 0, 0, 0, 0, 0, 0]);
    expect(normalizeBands(null)).toEqual(flat());
  });

  it("formats labels", () => {
    expect(EQ_FREQUENCIES.map(formatBandFrequency)).toEqual([
      "32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k",
    ]);
    expect(formatDb(3)).toBe("+3.0 dB");
    expect(formatDb(-0.01)).toBe("0.0 dB");
  });
});
