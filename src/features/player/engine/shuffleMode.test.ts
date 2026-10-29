import { describe, it, expect } from "vitest";
import { nextShuffleMode, SHUFFLE_MODES } from "./shuffleMode";
import type { ShuffleMode } from "../store/playerStore";

describe("shuffle mode", () => {
  it("cycles off -> playlist -> smart -> off", () => {
    expect(nextShuffleMode("off")).toBe("playlist");
    expect(nextShuffleMode("playlist")).toBe("smart");
    expect(nextShuffleMode("smart")).toBe("off");
  });

  it("handles unknown values safely", () => {
    const unknownMode: ShuffleMode = JSON.parse('"unknown"');
    expect(nextShuffleMode(unknownMode)).toBe("playlist");
  });

  it("contains all 3 supported modes", () => {
    expect(SHUFFLE_MODES).toEqual(["off", "playlist", "smart"]);
  });
});
