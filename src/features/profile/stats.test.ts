import { describe, it, expect } from "vitest";
import {
  computeListeningStats,
  extractArtistName,
  formatListeningHours,
} from "./stats";
import type { PlaybackHistoryItem } from "@/shared/contracts/history";

describe("Profile Stats Engine (stats.test.ts)", () => {
  it("handles empty or null history safely without NaN or errors (R2-C1)", () => {
    const emptyStats = computeListeningStats([]);
    expect(emptyStats.totalHoursListened).toBe(0);
    expect(Number.isNaN(emptyStats.totalHoursListened)).toBe(false);
    expect(emptyStats.totalTracksPlayed).toBe(0);
    expect(emptyStats.topTracks).toHaveLength(0);
    expect(emptyStats.topArtists).toHaveLength(0);
    expect(new Date(emptyStats.calculatedAt).getTime()).not.toBeNaN();

    const nullStats = computeListeningStats(null);
    expect(nullStats.totalHoursListened).toBe(0);

    const undefinedStats = computeListeningStats(undefined);
    expect(undefinedStats.totalHoursListened).toBe(0);
  });

  it("computes accurate listening statistics matching R2-T2 exact assertion (0.19 hrs)", () => {
    const trackA: any = {
      id: "trk_a",
      title: "Midnight City",
      artists: "M83",
      durationMs: 240000,
      coverUrl: "",
      playCount: 0,
    };
    const trackB: any = {
      id: "trk_b",
      title: "Resonance",
      artists: "HOME",
      durationMs: 210000,
      coverUrl: "",
      playCount: 0,
    };

    const history: PlaybackHistoryItem[] = [
      {
        id: "h1",
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track: trackA,
        playedDurationMs: 240000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T10:00:00Z",
      },
      {
        id: "h2",
        playbackSessionId: "s2",
        listeningSessionId: "l1",
        track: trackA,
        playedDurationMs: 240000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T11:00:00Z",
      },
      {
        id: "h3",
        playbackSessionId: "s3",
        listeningSessionId: "l1",
        track: trackB,
        playedDurationMs: 210000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T12:00:00Z",
      },
    ];

    const stats = computeListeningStats(history);

    expect(stats.totalTracksPlayed).toBe(3);
    // Total played = 240k + 240k + 210k = 690,000ms = 0.1916 hrs -> 0.19
    expect(stats.totalHoursListened).toBe(0.19);
    expect(stats.topTracks[0].track.id).toBe("trk_a");
    expect(stats.topTracks[0].playCount).toBe(2);
    expect(stats.topTracks[0].totalPlayedMs).toBe(480000);
    expect(stats.topArtists[0].artistName).toBe("M83");
    expect(stats.topArtists[0].playCount).toBe(2);
  });

  it("breaks ties deterministically: by duration then title for tracks, alphabetically for artists", () => {
    const trackAlpha: any = {
      id: "trk_alpha",
      title: "Alpha Song",
      artists: "Beta Artist",
      durationMs: 180000,
      coverUrl: "",
      playCount: 0,
    };
    const trackBeta: any = {
      id: "trk_beta",
      title: "Beta Song",
      artists: "Alpha Artist",
      durationMs: 240000,
      coverUrl: "",
      playCount: 0,
    };

    const history: PlaybackHistoryItem[] = [
      {
        id: "h1",
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track: trackAlpha,
        playedDurationMs: 180000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T10:00:00Z",
      },
      {
        id: "h2",
        playbackSessionId: "s2",
        listeningSessionId: "l1",
        track: trackBeta,
        playedDurationMs: 240000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T11:00:00Z",
      },
    ];

    const stats = computeListeningStats(history);

    // Both tracks have playCount 1. trackBeta has 240,000ms vs 180,000ms so ranks first.
    expect(stats.topTracks[0].track.id).toBe("trk_beta");
    expect(stats.topTracks[1].track.id).toBe("trk_alpha");

    // Both artists have playCount 1. "Alpha Artist" precedes "Beta Artist" alphabetically.
    expect(stats.topArtists[0].artistName).toBe("Alpha Artist");
    expect(stats.topArtists[1].artistName).toBe("Beta Artist");
  });

  it("safely extracts artist name across string, array, and missing fields", () => {
    expect(extractArtistName({ artists: "HOME" })).toBe("HOME");
    expect(
      extractArtistName({
        artists: [
          { id: "1", name: "Porter Robinson" },
          { id: "2", name: "Madeon" },
        ],
      })
    ).toBe("Porter Robinson, Madeon");
    expect(
      extractArtistName({
        artistList: [{ name: "Daft Punk" }],
      })
    ).toBe("Daft Punk");
    expect(extractArtistName({})).toBe("Unknown Artist");
    expect(extractArtistName(null)).toBe("Unknown Artist");
  });

  it("handles negative and malformed playedDurationMs safely", () => {
    const track: any = {
      id: "trk_1",
      title: "Test",
      artists: "Artist",
      durationMs: 100000,
      coverUrl: "",
      playCount: 0,
    };
    const history: PlaybackHistoryItem[] = [
      {
        id: "h1",
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track,
        playedDurationMs: -50000, // Negative duration
        completionRate: 0,
        completed: false,
        skipped: true,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T10:00:00Z",
      },
      {
        id: "h2",
        playbackSessionId: "s2",
        listeningSessionId: "l1",
        track,
        playedDurationMs: NaN as any, // NaN duration
        completionRate: 0,
        completed: false,
        skipped: true,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-20T11:00:00Z",
      },
    ];

    const stats = computeListeningStats(history);
    expect(stats.totalHoursListened).toBe(0);
    expect(Number.isNaN(stats.totalHoursListened)).toBe(false);
    expect(stats.totalTracksPlayed).toBe(2);
  });

  it("honors custom precision and topLimit options", () => {
    const trackA: any = { id: "trk_a", title: "A", artists: "A", durationMs: 240000, coverUrl: "", playCount: 0 };
    const trackB: any = { id: "trk_b", title: "B", artists: "B", durationMs: 240000, coverUrl: "", playCount: 0 };
    const trackC: any = { id: "trk_c", title: "C", artists: "C", durationMs: 210000, coverUrl: "", playCount: 0 };

    const history: PlaybackHistoryItem[] = [
      { id: "1", playbackSessionId: "1", listeningSessionId: "1", track: trackA, playedDurationMs: 240000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
      { id: "2", playbackSessionId: "2", listeningSessionId: "1", track: trackB, playedDurationMs: 240000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
      { id: "3", playbackSessionId: "3", listeningSessionId: "1", track: trackC, playedDurationMs: 210000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
    ];

    // Precision 1: 690,000 / 3,600,000 = 0.1916 -> 0.2
    const statsPrecision1 = computeListeningStats(history, { precision: 1, topLimit: 2 });
    expect(statsPrecision1.totalHoursListened).toBe(0.2);
    expect(statsPrecision1.topTracks).toHaveLength(2);
    expect(statsPrecision1.topArtists).toHaveLength(2);
  });

  it("formats listening hours cleanly for UI", () => {
    expect(formatListeningHours(0)).toBe("0 hrs");
    expect(formatListeningHours(0.19)).toBe("0.2 hrs");
    expect(formatListeningHours(12.4)).toBe("12.4 hrs");
    expect(formatListeningHours(-1)).toBe("0 hrs");
  });

  it("preserves immutability of input history", () => {
    const track: any = { id: "trk_1", title: "Song", artists: "Artist", durationMs: 100000, coverUrl: "", playCount: 0 };
    const item: PlaybackHistoryItem = {
      id: "h1",
      playbackSessionId: "s1",
      listeningSessionId: "l1",
      track,
      playedDurationMs: 100000,
      completionRate: 1.0,
      completed: true,
      skipped: false,
      loopCount: 0,
      hasSeekBackward: false,
      listenedAt: "2026-10-20T10:00:00Z",
    };
    const history = Object.freeze([Object.freeze(item)]) as PlaybackHistoryItem[];

    expect(() => computeListeningStats(history)).not.toThrow();
  });
});
