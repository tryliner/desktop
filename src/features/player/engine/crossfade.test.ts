import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import {
  GAPLESS_HEAD_START_MS,
  clampCrossfadeSeconds,
  transitionMs,
  transitionTiming,
} from "./crossfade";

const track = (id: string, durationMs: number, albumId?: string): Track => ({
  id,
  title: id,
  artists: "",
  coverUrl: "",
  durationMs,
  playCount: 0,
  ...(albumId ? { album: { id: albumId, title: albumId } } : {}),
});

describe("transitionMs", () => {
  it("is gapless when crossfade is off", () => {
    expect(transitionMs(track("a", 200_000), track("b", 200_000), 0)).toBe(0);
  });

  it("uses the crossfade length between unrelated tracks", () => {
    expect(transitionMs(track("a", 200_000), track("b", 200_000), 6)).toBe(
      6000,
    );
  });

  it("stays gapless between consecutive tracks of one album", () => {
    expect(
      transitionMs(track("a", 200_000, "x"), track("b", 200_000, "x"), 6),
    ).toBe(0);
    expect(
      transitionMs(track("a", 200_000, "x"), track("b", 200_000, "y"), 6),
    ).toBe(6000);
  });

  it("never fades longer than half of either track", () => {
    expect(transitionMs(track("a", 8_000), track("b", 200_000), 12)).toBe(4000);
    expect(transitionMs(track("a", 200_000), track("b", 10_000), 12)).toBe(
      5000,
    );
    expect(transitionMs(track("a", 0), track("b", 0), 3)).toBe(3000);
  });
});

describe("transitionTiming", () => {
  it("starts a gapless join a head start before the end", () => {
    expect(transitionTiming(500, 0)).toEqual({
      fadeMs: 0,
      startInMs: 500 - GAPLESS_HEAD_START_MS,
    });
  });

  it("starts a crossfade its length before the end", () => {
    expect(transitionTiming(8000, 6000)).toEqual({
      fadeMs: 6000,
      startInMs: 2000,
    });
  });

  it("never fades longer than the time left", () => {
    expect(transitionTiming(3000, 6000)).toEqual({
      fadeMs: 3000,
      startInMs: 0,
    });
    expect(transitionTiming(-50, 6000).fadeMs).toBe(0);
  });
});

describe("clampCrossfadeSeconds", () => {
  it("keeps saved values inside 0 to 12 whole seconds", () => {
    expect(clampCrossfadeSeconds(4.6)).toBe(5);
    expect(clampCrossfadeSeconds(99)).toBe(12);
    expect(clampCrossfadeSeconds(-3)).toBe(0);
    expect(clampCrossfadeSeconds(Number.NaN)).toBe(0);
    expect(clampCrossfadeSeconds("6")).toBe(0);
    expect(clampCrossfadeSeconds(undefined)).toBe(0);
  });
});
