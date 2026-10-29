import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import {
  SMART_MIX_MAX_RECS,
  interleaveRecommendations,
  pickRecommendations,
  smartMixRecCount,
} from "./smartMix";

const mk = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  artists: `Artist ${id}`,
  durationMs: 180000,
  coverUrl: "",
  playCount: 0,
});

describe("smartMixRecCount", () => {
  it("asks for one recommendation per two list tracks", () => {
    expect(smartMixRecCount(9)).toBe(5);
    expect(smartMixRecCount(10)).toBe(5);
    expect(smartMixRecCount(1)).toBe(1);
  });

  it("asks for nothing when no list tracks are left", () => {
    expect(smartMixRecCount(0)).toBe(0);
  });

  it("caps the number of recommendations", () => {
    expect(smartMixRecCount(1000)).toBe(SMART_MIX_MAX_RECS);
  });
});

describe("pickRecommendations", () => {
  it("skips known and duplicate tracks and tags the rest", () => {
    const picked = pickRecommendations(
      [mk("a"), mk("x"), mk("x"), mk("y"), mk("z")],
      ["a"],
      2,
    );
    expect(picked.map((t) => t.id)).toEqual(["x", "y"]);
    expect(picked.every((t) => t.isRecommended)).toBe(true);
  });
});

describe("interleaveRecommendations", () => {
  it("puts a recommendation after every second list track", () => {
    const mixed = interleaveRecommendations(
      ["1", "2", "3", "4", "5"].map(mk),
      ["r1", "r2", "r3"].map((id) => ({ ...mk(id), isRecommended: true })),
    );
    expect(mixed.map((t) => t.id)).toEqual([
      "1",
      "2",
      "r1",
      "3",
      "4",
      "r2",
      "5",
    ]);
  });

  it("still adds one recommendation to a single upcoming track", () => {
    const mixed = interleaveRecommendations([mk("1")], [mk("r1")]);
    expect(mixed.map((t) => t.id)).toEqual(["1", "r1"]);
  });

  it("returns the list unchanged without recommendations", () => {
    const upcoming = [mk("1"), mk("2")];
    expect(interleaveRecommendations(upcoming, [])).toEqual(upcoming);
  });
});
