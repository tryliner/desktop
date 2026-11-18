import { describe, it, expect } from "vitest";
import {
  analyzeLevels,
  frameLevels,
  mixDown,
  FRAME_MS,
  type TrackAnalysis,
} from "./trackAnalysis";
import {
  GAPLESS_LEAD_MS,
  fadeInLevel,
  fadeOutLevel,
  normalizeGain,
  planTransition,
  type TransitionSettings,
} from "./planTransition";

/** builds a level curve (dBFS per 50 ms frame) from [seconds, dB] segments */
function curve(...segments: [number, number | [number, number]][]) {
  const out: number[] = [];
  for (const [seconds, level] of segments) {
    const frames = Math.round((seconds * 1000) / FRAME_MS);
    for (let i = 0; i < frames; i++) {
      out.push(
        Array.isArray(level)
          ? level[0] + ((level[1] - level[0]) * i) / Math.max(1, frames - 1)
          : level,
      );
    }
  }
  return Float32Array.from(out);
}

describe("track analysis", () => {
  it("measures silence at both ends", () => {
    const result = analyzeLevels(curve([1.5, -80], [180, -14], [3, -90]));
    expect(result.leadingSilenceMs).toBe(1500);
    expect(result.trailingSilenceMs).toBe(3000);
    expect(result.loudnessDb).toBeCloseTo(-14, 0);
    expect(result.fadesOut).toBe(false);
  });

  it("spots a song that fades out by itself", () => {
    const result = analyzeLevels(curve([180, -12], [10, [-12, -45]], [1, -90]));
    expect(result.fadesOut).toBe(true);
    expect(result.outroFadeMs).toBeGreaterThan(5_000);
    expect(result.outroEnergyDb).toBeLessThan(-3);
  });

  it("doesn't call a quiet bridge a fade-out", () => {
    const result = analyzeLevels(
      curve([90, -12], [8, -30], [90, -12], [0.5, -90]),
    );
    expect(result.fadesOut).toBe(false);
  });

  it("handles a silent file", () => {
    const result = analyzeLevels(curve([10, -120]));
    expect(result.loudnessDb).toBe(-120);
    expect(result.leadingSilenceMs).toBe(0);
  });

  it("turns samples into frame levels", () => {
    const rate = 1000;
    const samples = new Float32Array(rate); // 1 s
    for (let i = 500; i < 1000; i++) samples[i] = i % 2 ? 0.5 : -0.5;
    const levels = frameLevels(samples, rate, 100);
    expect(levels).toHaveLength(10);
    expect(levels[0]).toBeLessThan(-100);
    expect(levels[9]).toBeCloseTo(20 * Math.log10(0.5), 1);
  });

  it("mixes channels down to mono", () => {
    const mono = mixDown([
      Float32Array.from([1, 0]),
      Float32Array.from([0, 1]),
    ]);
    expect(Array.from(mono)).toEqual([0.5, 0.5]);
  });
});

const base: TransitionSettings = {
  crossfadeMs: 6_000,
  gapless: false,
  automix: true,
  normalize: false,
};

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

const song = (patch: Partial<TrackAnalysis> = {}, albumId?: string) => ({
  durationMs: 200_000,
  analysis: analysis(patch),
  albumId,
});

describe("transition planner", () => {
  it("is off with no crossfade and no gapless", () => {
    expect(
      planTransition({ ...base, crossfadeMs: 0 }, song(), song()),
    ).toBeNull();
  });

  it("does a plain timed crossfade without analysis", () => {
    const plan = planTransition(
      { ...base, automix: false },
      { durationMs: 200_000 },
      { durationMs: 180_000 },
    );
    expect(plan).toEqual({
      kind: "crossfade",
      startAtMs: 194_000,
      fadeOutMs: 6_000,
      fadeInMs: 6_000,
      incomingOffsetMs: 0,
    });
  });

  it("trims trailing silence and skips the next song's quiet lead-in", () => {
    const plan = planTransition(
      base,
      song({ trailingSilenceMs: 4_000 }),
      song({ leadingSilenceMs: 1_200 }),
    )!;
    expect(plan.startAtMs).toBe(200_000 - 4_000 - 6_000);
    expect(plan.incomingOffsetMs).toBe(1_200);
  });

  it("lets a song that fades by itself fade, and slides the next one under", () => {
    const plan = planTransition(
      base,
      song({ fadesOut: true, outroFadeMs: 9_000, outroEnergyDb: -10 }),
      song(),
    )!;
    expect(plan.fadeOutMs).toBeLessThanOrEqual(1_500);
    expect(plan.fadeInMs).toBeGreaterThan(plan.fadeOutMs);
  });

  it("keeps loud-into-loud blends short", () => {
    const plan = planTransition(
      { ...base, crossfadeMs: 10_000 },
      song({ outroEnergyDb: -1 }),
      song({ introEnergyDb: -1 }),
    )!;
    expect(200_000 - plan.startAtMs).toBeLessThanOrEqual(4_000);
  });

  it("blends longer out of a quiet outro", () => {
    const plan = planTransition(base, song({ outroEnergyDb: -12 }), song())!;
    expect(200_000 - plan.startAtMs).toBe(7_500);
  });

  it("plays songs from the same album back to back, untouched", () => {
    const plan = planTransition(
      base,
      song({}, "album-1"),
      song({}, "album-1"),
    )!;
    expect(plan.kind).toBe("gapless");
    expect(plan.incomingOffsetMs).toBe(0);
    expect(plan.startAtMs).toBe(200_000 - GAPLESS_LEAD_MS);
  });

  it("does gapless on its own when asked", () => {
    const plan = planTransition(
      { ...base, crossfadeMs: 0, gapless: true },
      song({ trailingSilenceMs: 300 }),
      song(),
    )!;
    expect(plan).toMatchObject({ kind: "gapless", fadeOutMs: 0, fadeInMs: 0 });
    expect(plan.startAtMs).toBe(200_000 - 300 - GAPLESS_LEAD_MS);
  });

  it("never blends more than a third of a short song", () => {
    const plan = planTransition(
      { ...base, crossfadeMs: 12_000, automix: false },
      { durationMs: 24_000 },
      { durationMs: 200_000 },
    )!;
    expect(24_000 - plan.startAtMs).toBe(8_000);
  });

  it("skips very short songs", () => {
    expect(planTransition(base, { durationMs: 12_000 }, song())).toBeNull();
  });
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
