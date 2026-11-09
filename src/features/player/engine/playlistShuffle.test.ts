import { describe, expect, it } from "vitest";
import { LazyShuffle, isPlaylistContext } from "./playlistShuffle";

describe("LazyShuffle", () => {
  it("draws every index exactly once with the pinned one first", () => {
    const shuffle = new LazyShuffle(1000, 437);
    const drawn = [437, ...shuffle.draw(400), ...shuffle.draw(10_000)];
    expect(drawn).toHaveLength(1000);
    expect(new Set(drawn).size).toBe(1000);
    expect(shuffle.remaining).toBe(0);
    expect(shuffle.draw(5)).toEqual([]);
  });

  it("only touches as many entries as were asked for", () => {
    const shuffle = new LazyShuffle(1_000_000, 0);
    const started = performance.now();
    const drawn = shuffle.draw(100);
    expect(performance.now() - started).toBeLessThan(20);
    expect(drawn).toHaveLength(100);
    expect(shuffle.remaining).toBe(999_899);
  });

  it("folds indices added later into the undrawn part", () => {
    const shuffle = new LazyShuffle(3, 1);
    const early = shuffle.draw(1);
    shuffle.grow(5);
    const rest = shuffle.draw(100);
    const all = [1, ...early, ...rest];
    expect([...all].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("is close to uniform", () => {
    const counts = new Map<string, number>();
    const runs = 24_000;
    for (let i = 0; i < runs; i++) {
      const key = new LazyShuffle(4, 0).draw(3).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(Math.abs(count - runs / 6)).toBeLessThan(runs / 6 / 10);
    }
  });
});

describe("isPlaylistContext", () => {
  it("only matches playlist sources", () => {
    expect(isPlaylistContext("playlist:abc")).toBe(true);
    expect(isPlaylistContext("playlist:likes")).toBe(true);
    expect(isPlaylistContext("album:abc")).toBe(false);
    expect(isPlaylistContext("radio:abc")).toBe(false);
    expect(isPlaylistContext("Liked Songs")).toBe(false);
    expect(isPlaylistContext(null)).toBe(false);
  });
});
