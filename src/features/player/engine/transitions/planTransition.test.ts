import { describe, it, expect } from "vitest";
import type { TrackAnalysis } from "./trackAnalysis";
import {
  GAPLESS_LEAD_MS,
  planTransition,
  type TransitionSettings,
} from "./planTransition";

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
      fadeOutDelayMs: 0,
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

  it("waits to fade a song that fades by itself until the overlap ends", () => {
    const plan = planTransition(
      base,
      song({ fadesOut: true, outroFadeMs: 9_000, outroEnergyDb: -10 }),
      song(),
    )!;
    const overlap = 200_000 - plan.startAtMs;
    expect(plan.fadeOutDelayMs + plan.fadeOutMs).toBe(overlap);
  });

  it("keeps an album's own ending, silence and all", () => {
    const plan = planTransition(
      base,
      song({ trailingSilenceMs: 4_000 }, "album-1"),
      song({}, "album-1"),
    )!;
    expect(plan.startAtMs).toBe(200_000 - GAPLESS_LEAD_MS);
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
