import { describe, it, expect } from "vitest";
import { analyzeLevels, frameLevels, FRAME_MS } from "./trackAnalysis";
import { mixDown } from "./decodeAnalysis";

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
    const samples = new Float32Array(rate);
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
