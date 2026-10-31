import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/types";
import { playbackSnapshot } from "./playbackSnapshot";

const base: Track = {
  id: "dQw4w9WgXcQ",
  title: "Never Gonna Give You Up",
  artists: "Rick Astley, Someone Else",
  artistId: "UC1",
  artistList: [
    { id: "UC1", name: "Rick Astley" },
    { id: "UC2", name: "Someone Else" },
  ],
  coverUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  durationMs: 213_000,
  playCount: 0,
  album: { id: "MPREb_1", title: "Whenever You Need Somebody" },
};

describe("playbackSnapshot", () => {
  it("sends the real artist list, album and cover url", () => {
    expect(playbackSnapshot(base, 0)).toEqual({
      id: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      artists: [
        { id: "UC1", name: "Rick Astley" },
        { id: "UC2", name: "Someone Else" },
      ],
      album: { id: "MPREb_1", title: "Whenever You Need Somebody" },
      durationMs: 213_000,
      cover: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
    });
  });

  it("keeps artists without an id by name only", () => {
    const snap = playbackSnapshot(
      {
        ...base,
        artistList: [{ name: "Rick Astley" }, { id: "unknown", name: "Guest" }],
      },
      0,
    );
    expect(snap?.artists).toEqual([{ name: "Rick Astley" }, { name: "Guest" }]);
  });

  it("is left out without a structured artist list or a title", () => {
    expect(
      playbackSnapshot({ ...base, artistList: undefined }, 0),
    ).toBeUndefined();
    expect(
      playbackSnapshot({ ...base, artistList: [{ name: " " }] }, 0),
    ).toBeUndefined();
    expect(playbackSnapshot({ ...base, title: "" }, 0)).toBeUndefined();
  });

  it("drops a half-known album and falls back to the measured duration", () => {
    const snap = playbackSnapshot(
      { ...base, album: { id: "", title: "" }, coverUrl: "", durationMs: 0 },
      180_000,
    );
    expect(snap).not.toHaveProperty("album");
    expect(snap).not.toHaveProperty("cover");
    expect(snap?.durationMs).toBe(180_000);
  });
});
