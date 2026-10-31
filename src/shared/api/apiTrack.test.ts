import { describe, expect, it } from "vitest";
import type { Track } from "@/shared/contracts";
import { toApiTrack } from "./apiTrack";

const track: Track = {
  id: "dQw4w9WgXcQ",
  title: " Never Gonna Give You Up ",
  artists: [
    { id: "UC1", name: "Rick Astley" },
    { id: "", name: "Guest" },
    { id: null, name: " " },
  ],
  durationMs: 213_000.4,
  album: { id: "MPREb_1", title: "Whenever You Need Somebody" },
  cover: {
    url: "https://i.ytimg.com/a.jpg",
    width: 0,
    height: 360,
    fallbackUrl: "x",
  },
  audioVariant: "music-video",
  explicit: false,
};

describe("toApiTrack", () => {
  it("sends the api Track: null for unknown ids and sizes, no client fields", () => {
    expect(toApiTrack(track)).toEqual({
      id: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      artists: [
        { id: "UC1", name: "Rick Astley" },
        { id: null, name: "Guest" },
      ],
      durationMs: 213_000,
      album: { id: "MPREb_1", title: "Whenever You Need Somebody" },
      cover: { url: "https://i.ytimg.com/a.jpg", width: null, height: 360 },
      explicit: false,
    });
  });

  it("sends an unknown duration as null", () => {
    expect(toApiTrack({ ...track, durationMs: 0 })?.durationMs).toBeNull();
    expect(toApiTrack({ ...track, durationMs: null })?.durationMs).toBeNull();
  });

  it("leaves out a track the api would refuse", () => {
    expect(toApiTrack(undefined)).toBeUndefined();
    expect(toApiTrack({ ...track, title: " " })).toBeUndefined();
    expect(
      toApiTrack({ ...track, artists: [{ id: null, name: "" }] }),
    ).toBeUndefined();
  });
});
