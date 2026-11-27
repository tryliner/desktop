import { describe, expect, it } from "vitest";
import { shouldKeepPlayingInBackground } from "./background-playback";

describe("shouldKeepPlayingInBackground", () => {
  it("keeps the app alive while a track is playing or buffering", () => {
    expect(shouldKeepPlayingInBackground("playing", false)).toBe(true);
    expect(shouldKeepPlayingInBackground("buffering", false)).toBe(true);
  });

  it("lets the window close normally when nothing is playing", () => {
    expect(shouldKeepPlayingInBackground("paused", false)).toBe(false);
    expect(shouldKeepPlayingInBackground("idle", false)).toBe(false);
    expect(shouldKeepPlayingInBackground(undefined, false)).toBe(false);
  });

  it("never keeps the app alive once a quit has started", () => {
    expect(shouldKeepPlayingInBackground("playing", true)).toBe(false);
  });
});
