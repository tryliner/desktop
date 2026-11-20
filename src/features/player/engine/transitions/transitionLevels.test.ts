import { describe, it, expect } from "vitest";
import type { TrackAnalysis } from "./trackAnalysis";
import { fadeInLevel, fadeOutLevel, normalizeGain } from "./planTransition";

const analysis = (patch: Partial<TrackAnalysis> = {}): TrackAnalysis => ({
  version: 1,
  durationMs: 200_000,
  leadingSilenceMs: 0,
  trailingSilenceMs: 0,
  loudnessDb: -14,
  introEnergyDb: -2,
  outroEnergyDb: -6,
  fadesOut: false,
  outroFadeMs: 0,
  ...patch,
});

describe("levels", () => {
  it("only turns loud songs down", () => {
    expect(normalizeGain(analysis({ loudnessDb: -16 }))).toBe(1);
    expect(normalizeGain(analysis({ loudnessDb: -8 }))).toBeCloseTo(
      10 ** (-4 / 20),
      5,
    );
    expect(normalizeGain(analysis({ loudnessDb: 5 }))).toBeCloseTo(
      10 ** (-6 / 20),
      5,
    );
    expect(normalizeGain(null)).toBe(1);
  });

  it("keeps the summed power steady through an equal-power blend", () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(fadeOutLevel(p) ** 2 + fadeInLevel(p) ** 2).toBeCloseTo(1, 6);
    }
  });
});
