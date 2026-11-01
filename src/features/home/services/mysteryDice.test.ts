import { describe, it, expect } from "vitest";
import {
  classifyGenre,
  calculateTrackScore,
  fisherYatesShuffle,
  deduplicateConsecutiveArtists,
  generateMysteryQueue,
  MYSTERY_GENRES,
} from "./mysteryDice";
import type { Track } from "@/shared/types/track";

describe("mysteryDice service", () => {
  it("classifies tracks into appropriate genres", () => {
    expect(
      classifyGenre({
        title: "Nơi này có anh",
        artists: "Sơn Tùng M-TP",
      }),
    ).toBe("V-Pop");

    expect(
      classifyGenre({
        title: "Ditto",
        artists: "NewJeans",
      }),
    ).toBe("K-Pop");

    expect(
      classifyGenre({
        title: "Kaikai Kitan",
        artists: "Eve",
      }),
    ).toBe("Anime / J-Pop");

    expect(
      classifyGenre({
        title: "Chill lofi study beats",
        artists: "Lofi Girl",
      }),
    ).toBe("Lo-Fi / Chill");

    expect(
      classifyGenre({
        title: "Fade (EDM Remix)",
        artists: "Alan Walker",
      }),
    ).toBe("Electronic / EDM");

    expect(
      classifyGenre({
        title: "Lose Yourself feat. Rap",
        artists: "Eminem",
      }),
    ).toBe("Hip-Hop / Rap");

    expect(
      classifyGenre({
        title: "Hotel California (Acoustic Solo)",
        artists: "Eagles",
      }),
    ).toBe("Acoustic / Ballad");

    expect(
      classifyGenre({
        title: "Enter Sandman (Heavy Metal)",
        artists: "Metallica",
      }),
    ).toBe("Rock / Metal");
  });

  it("calculates track score with recency and skip penalty", () => {
    const now = Date.now();
    const track: Partial<Track> = { playCount: 5 }; // base: 10 + 10 = 20

    // Recent (< 24h)
    const recentScore = calculateTrackScore(
      track,
      { lastPlayedTimestamp: now - 1000 * 60 * 60 },
      now,
    );
    expect(recentScore).toBe(20 * 3.0); // 60

    // Older
    const normalScore = calculateTrackScore(track, undefined, now);
    expect(normalScore).toBe(20);

    // Skipped quickly
    const skippedScore = calculateTrackScore(
      track,
      { wasSkippedQuickly: true },
      now,
    );
    expect(skippedScore).toBe(20 * 0.5); // 10
  });

  it("shuffles items while preserving all elements", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const originalCopy = [...original];
    const shuffled = fisherYatesShuffle(original);

    expect(original).toEqual(originalCopy);
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(originalCopy);
  });

  it("deduplicates consecutive tracks from the same artist", () => {
    const tracks: Track[] = [
      { id: "1", title: "A1", artists: "Artist A", coverUrl: "", durationMs: 1000, playCount: 1 },
      { id: "2", title: "A2", artists: "Artist A", coverUrl: "", durationMs: 1000, playCount: 1 },
      { id: "3", title: "B1", artists: "Artist B", coverUrl: "", durationMs: 1000, playCount: 1 },
      { id: "4", title: "A3", artists: "Artist A", coverUrl: "", durationMs: 1000, playCount: 1 },
    ];

    const deduplicated = deduplicateConsecutiveArtists(tracks);
    expect(deduplicated).toHaveLength(4);
    // Track 0 and Track 1 should not have the same artist if another artist is available
    expect(deduplicated[0]?.artists).not.toBe(deduplicated[1]?.artists);
  });

  it("generates a mystery queue from pool", () => {
    const pool: Track[] = [
      { id: "1", title: "Cơn Mưa Ngang Qua", artists: "Sơn Tùng", coverUrl: "", durationMs: 1000, playCount: 5 },
      { id: "2", title: "Em Của Ngày Hôm Qua", artists: "Sơn Tùng", coverUrl: "", durationMs: 1000, playCount: 10 },
      { id: "3", title: "Ánh Nắng Của Anh", artists: "Đức Phúc", coverUrl: "", durationMs: 1000, playCount: 8 },
      { id: "4", title: "Ditto", artists: "NewJeans", coverUrl: "", durationMs: 1000, playCount: 12 },
    ];

    const result = generateMysteryQueue(pool, { targetGenre: "V-Pop", count: 3 });
    expect(result.genre).toBe("V-Pop");
    expect(result.tracks.length).toBeGreaterThan(0);
    expect(MYSTERY_GENRES).toContain(result.genre);
  });
});
