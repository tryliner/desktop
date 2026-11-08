import { describe, expect, it } from "vitest";
import {
  stepVolumeGain,
  toVolumeGain,
  toVolumeLevel,
} from "@/features/player/engine/volume";
import { isVolumeStep, stepVolumeLevel } from "./volumeStep";

describe("volume step", () => {
  it("moves the slider level by the chosen step and clamps", () => {
    expect(stepVolumeLevel(0.5, 1, 0.05)).toBe(0.55);
    expect(stepVolumeLevel(0.5, -1, 0.1)).toBe(0.4);
    expect(stepVolumeLevel(0.99, 1, 0.05)).toBe(1);
    expect(stepVolumeLevel(0.01, -1, 0.02)).toBe(0);
  });

  it("steps gain on the same perceptual curve as the slider", () => {
    const gain = toVolumeGain(0.5);
    const next = stepVolumeGain(gain, 1, 0.01);
    expect(toVolumeLevel(next)).toBeCloseTo(0.51, 5);
  });

  it("only accepts the offered steps", () => {
    expect(isVolumeStep(0.05)).toBe(true);
    expect(isVolumeStep(0.03)).toBe(false);
    expect(isVolumeStep("0.05")).toBe(false);
  });
});
