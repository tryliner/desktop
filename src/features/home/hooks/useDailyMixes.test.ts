import { describe, it, expect } from "vitest";
import { getDailyMixArtists } from "./useDailyMixes";
import type { Track } from "@/shared/types";

describe("getDailyMixArtists", () => {
  it("extracts 3-4 artists from cluster artists and tracks", () => {
    const clusterArtists = ["Rae Sremmurd"];
    const tracks: Track[] = [
      {
        id: "1",
        title: "No Type",
        artists: "Rae Sremmurd",
        coverUrl: "",
        durationMs: 200000,
        playCount: 10,
      },
      {
        id: "2",
        title: "For The Night",
        artists: "Pop Smoke, Lil Baby, DaBaby",
        artistList: [
          { id: "a1", name: "Pop Smoke" },
          { id: "a2", name: "Lil Baby" },
          { id: "a3", name: "DaBaby" },
        ],
        coverUrl: "",
        durationMs: 190000,
        playCount: 5,
      },
      {
        id: "3",
        title: "Hope",
        artists: "XXXTENTACION",
        coverUrl: "",
        durationMs: 110000,
        playCount: 20,
      },
    ];

    const result = getDailyMixArtists(clusterArtists, tracks, 4);
    expect(result).toEqual(["Rae Sremmurd", "Pop Smoke", "Lil Baby", "DaBaby"]);
  });

  it("deduplicates case-insensitively and handles missing cluster artists", () => {
    const tracks: Track[] = [
      {
        id: "1",
        title: "Track 1",
        artists: "Drake",
        coverUrl: "",
        durationMs: 200000,
        playCount: 10,
      },
      {
        id: "2",
        title: "Track 2",
        artists: "drake, 21 Savage",
        coverUrl: "",
        durationMs: 200000,
        playCount: 10,
      },
    ];

    const result = getDailyMixArtists([], tracks, 4);
    expect(result).toEqual(["Drake", "21 Savage"]);
  });
});
