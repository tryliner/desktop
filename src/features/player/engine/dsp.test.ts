import { describe, it, expect } from "vitest";
import {
  EBU_R128_NORMALIZER,
  CROSSFEED_PRESETS,
  dbToLinear,
  isCrossfeedActive,
} from "./dsp";

describe("DSP Audio Normalizer and Crossfeed specifications", () => {
  it("provides EBU R128 dynamic compression parameters", () => {
    expect(EBU_R128_NORMALIZER.threshold).toBe(-18.0);
    expect(EBU_R128_NORMALIZER.knee).toBe(24.0);
    expect(EBU_R128_NORMALIZER.ratio).toBe(4.0);
    expect(EBU_R128_NORMALIZER.attack).toBe(0.005);
    expect(EBU_R128_NORMALIZER.release).toBe(0.15);
  });

  it("provides spatial 3D audio presets", () => {
    expect(CROSSFEED_PRESETS.subtle).toEqual({
      delaySeconds: 0.0003,
      cutoffHz: 800,
      crossGainDb: -6.0,
      surroundDelaySeconds: 0.012,
      surroundGainDb: -14.0,
      elevationGainDb: 1.2,
      spatialRoomWet: 0.08,
    });
    expect(CROSSFEED_PRESETS.standard).toEqual({
      delaySeconds: 0.0004,
      cutoffHz: 700,
      crossGainDb: -4.5,
      surroundDelaySeconds: 0.016,
      surroundGainDb: -9.5,
      elevationGainDb: 2.5,
      spatialRoomWet: 0.18,
    });
    expect(CROSSFEED_PRESETS.wide).toEqual({
      delaySeconds: 0.0005,
      cutoffHz: 650,
      crossGainDb: -3.5,
      surroundDelaySeconds: 0.022,
      surroundGainDb: -7.0,
      elevationGainDb: 3.5,
      spatialRoomWet: 0.28,
    });
  });

  it("correctly converts dB to linear scale", () => {
    expect(dbToLinear(0)).toBeCloseTo(1.0);
    expect(dbToLinear(-6.0)).toBeCloseTo(0.501, 2);
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 2);
  });

  it("determines active crossfeed modes correctly", () => {
    expect(isCrossfeedActive("off")).toBe(false);
    expect(isCrossfeedActive("subtle")).toBe(true);
    expect(isCrossfeedActive("standard")).toBe(true);
    expect(isCrossfeedActive("wide")).toBe(true);
  });
});
