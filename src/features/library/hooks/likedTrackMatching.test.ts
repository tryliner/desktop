import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import { equivalentTrack } from "./likedTrackMatching";

function track(overrides: Partial<Track>): Track {
  return {
    id: "track",
    title: "Song",
    artists: "Artist",
    artistList: [],
    coverUrl: "",
    durationMs: 180_000,
    playCount: 0,
    ...overrides,
  };
}

describe("liked track matching", () => {
  it("matches an empty artistList from the artist string", () => {
    expect(
      equivalentTrack(
        track({ id: "album", artistList: [] }),
        track({
          id: "liked",
          artistList: [{ id: "artist", name: "Artist" }],
        }),
      ),
    ).toBe(true);
  });

  it("does not match the same title and duration for another artist", () => {
    expect(
      equivalentTrack(
        track({ id: "album", artists: "Artist A", artistList: [] }),
        track({
          id: "liked",
          artists: "Artist B",
          artistList: [{ id: "artist-b", name: "Artist B" }],
        }),
      ),
    ).toBe(false);
  });
});
