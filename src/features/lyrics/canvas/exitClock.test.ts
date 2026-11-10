import { describe, expect, it } from "vitest";
import { exitFade } from "./exitClock";
import { isLineAnimating } from "./timing";
import { alignOffset } from "./wrapRuns";
import type { LyricLineModel } from "./types";

function line(): LyricLineModel {
  return {
    startMs: 1000,
    durationMs: 1000,
    endMs: 2000,
    nextStartMs: 3000,
    align: "start",
    rtl: false,
    instrumental: false,
    tokens: [
      {
        text: "word",
        startMs: 1000,
        durationMs: 1000,
        background: false,
        space: false,
      },
    ],
    subtitle: null,
  };
}

describe("exit fade", () => {
  it("fades out again when the line is played a second time", () => {
    const model = line();
    expect(exitFade(model, 3000, 10_000)).toBe(1);
    expect(exitFade(model, 3600, 10_600)).toBe(0);

    // seek back before the line ends and play through its exit again
    isLineAnimating(model, 1500, 20_000);
    expect(exitFade(model, 3000, 21_500)).toBe(1);
    expect(exitFade(model, 3100, 21_600)).toBeGreaterThan(0.5);
  });

  it("keeps fading through a small step back of the media clock", () => {
    const model = line();
    exitFade(model, 3000, 10_000);
    isLineAnimating(model, 2950, 10_300);
    expect(exitFade(model, 3010, 10_300)).toBeLessThan(0.5);
  });
});

describe("alignOffset", () => {
  it("keeps a word wider than the row inside both margins", () => {
    expect(alignOffset("end", 120, 100)).toBe(-10);
    expect(alignOffset("center", 120, 100)).toBe(-10);
    expect(alignOffset("start", 120, 100)).toBe(0);
    expect(alignOffset("end", 80, 100)).toBe(20);
  });
});
