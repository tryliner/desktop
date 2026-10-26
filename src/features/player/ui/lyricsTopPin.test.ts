import { describe, expect, it } from "vitest";
import { FRESH_TRACK_MS, TOP_PIN_MAX_MS, shouldReleaseTopPin, startsPinnedToTop } from "./lyricsTopPin";

describe("lyrics pin to top on a new song", () => {
  it("pins a song that is loading or just started, not one opened mid-song", () => {
    expect(startsPinnedToTop("loading", 95_000)).toBe(true);
    expect(startsPinnedToTop("playing", 400)).toBe(true);
    expect(startsPinnedToTop("playing", 95_000)).toBe(false);
    expect(startsPinnedToTop("paused", 60_000)).toBe(false);
  });

  it("holds while the audio element still carries the previous song's position", () => {
    expect(shouldReleaseTopPin({ status: "loading", audioPaused: true, audioTimeMs: 150_000, pinnedForMs: 300 })).toBe(false);
    expect(shouldReleaseTopPin({ status: "playing", audioPaused: false, audioTimeMs: 150_000, pinnedForMs: 300 })).toBe(false);
  });

  it("lets lyrics follow once the new song plays from its start", () => {
    expect(shouldReleaseTopPin({ status: "playing", audioPaused: false, audioTimeMs: 120, pinnedForMs: 500 })).toBe(true);
    expect(shouldReleaseTopPin({ status: "playing", audioPaused: false, audioTimeMs: FRESH_TRACK_MS + 1, pinnedForMs: 500 })).toBe(false);
  });

  it("never stays pinned forever", () => {
    expect(shouldReleaseTopPin({ status: "paused", audioPaused: true, audioTimeMs: 0, pinnedForMs: TOP_PIN_MAX_MS + 1 })).toBe(true);
  });
});
