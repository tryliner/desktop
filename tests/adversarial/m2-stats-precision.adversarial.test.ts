import { describe, it, expect } from "vitest";
import {
  computeListeningStats,
  extractArtistName,
  formatListeningHours,
} from "@/features/profile/stats";
import type { PlaybackHistoryItem } from "@/shared/contracts/history";
import type { Track } from "@/shared/types";

describe("Adversarial M2.2: Stats Engine & Precision Stress Suite", () => {
  // --------------------------------------------------------------------------
  // 1. Empty, Null, Undefined, Sparse, and Malformed History
  // --------------------------------------------------------------------------
  describe("1. Empty, Null, Undefined, Sparse, and Malformed Inputs", () => {
    it("handles empty array cleanly without NaN and produces valid ISO timestamp", () => {
      const stats = computeListeningStats([]);

      expect(stats.totalHoursListened).toBe(0);
      expect(Number.isNaN(stats.totalHoursListened)).toBe(false);
      expect(Number.isFinite(stats.totalHoursListened)).toBe(true);
      expect(stats.totalTracksPlayed).toBe(0);
      expect(stats.topTracks).toEqual([]);
      expect(stats.topArtists).toEqual([]);
      expect(typeof stats.calculatedAt).toBe("string");
      expect(Number.isNaN(Date.parse(stats.calculatedAt))).toBe(false);
    });

    it("handles null and undefined input safely", () => {
      const statsNull = computeListeningStats(null);
      expect(statsNull.totalHoursListened).toBe(0);
      expect(statsNull.totalTracksPlayed).toBe(0);
      expect(statsNull.topTracks).toEqual([]);
      expect(statsNull.topArtists).toEqual([]);
      expect(Number.isNaN(Date.parse(statsNull.calculatedAt))).toBe(false);

      const statsUndefined = computeListeningStats(undefined);
      expect(statsUndefined.totalHoursListened).toBe(0);
      expect(statsUndefined.totalTracksPlayed).toBe(0);
      expect(statsUndefined.topTracks).toEqual([]);
      expect(statsUndefined.topArtists).toEqual([]);
      expect(Number.isNaN(Date.parse(statsUndefined.calculatedAt))).toBe(false);
    });

    it("handles sparse arrays containing holes or undefined items safely", () => {
      const sparseArray: PlaybackHistoryItem[] = new Array(5);
      sparseArray[1] = {
        id: "h_sparse_1",
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track: {
          id: "trk_s1",
          title: "Sparse Track",
          artists: "Ghost",
          durationMs: 180000,
          coverUrl: "",
          playCount: 0,
        },
        playedDurationMs: 180000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-22T08:00:00Z",
      };

      const stats = computeListeningStats(sparseArray);
      expect(stats.totalTracksPlayed).toBe(5);
      expect(stats.totalHoursListened).toBe(0.05); // 180,000 / 3,600,000 = 0.05
      expect(stats.topTracks).toHaveLength(1);
      expect(stats.topTracks[0].track.id).toBe("trk_s1");
    });

    it("skips history entries with null or missing track objects without crashing", () => {
      const malformedHistory: any[] = [
        null,
        undefined,
        {},
        { id: "h_no_track", playedDurationMs: 300000 },
        { id: "h_null_track", track: null, playedDurationMs: 250000 },
        {
          id: "h_valid",
          track: { id: "trk_ok", title: "Valid Song", artists: "Artist", durationMs: 120000, coverUrl: "", playCount: 0 },
          playedDurationMs: 120000,
        },
      ];

      const stats = computeListeningStats(malformedHistory);
      expect(stats.totalTracksPlayed).toBe(6);
      expect(stats.topTracks).toHaveLength(1);
      expect(stats.topTracks[0].track.id).toBe("trk_ok");
      expect(stats.topArtists).toHaveLength(1);
      expect(stats.topArtists[0].artistName).toBe("Artist");
      // Only valid song playedDurationMs (120,000ms = 0.0333... -> 0.03 hrs)
      expect(stats.totalHoursListened).toBe(0.03);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Exact Precision Compliance
  // --------------------------------------------------------------------------
  describe("2. Exact Precision Compliance & Rounding", () => {
    function makeHistoryItem(playedMs: number, id = "trk_1"): PlaybackHistoryItem {
      return {
        id: `h_${Math.random()}`,
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track: { id, title: `Title ${id}`, artists: "Artist", durationMs: playedMs, coverUrl: "", playCount: 0 },
        playedDurationMs: playedMs,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-23T00:00:00Z",
      };
    }

    it("strictly satisfies R2-T2 assertion: 690,000ms yields exactly 0.19 hrs", () => {
      // 240,000 + 240,000 + 210,000 = 690,000 ms
      const history: PlaybackHistoryItem[] = [
        makeHistoryItem(240000, "trk_a"),
        makeHistoryItem(240000, "trk_a"),
        makeHistoryItem(210000, "trk_b"),
      ];

      const stats = computeListeningStats(history);
      expect(stats.totalHoursListened).toBe(0.19);
      expect(stats.totalHoursListened).not.toBe(0.2);
    });

    it("strictly satisfies Tier 4 Scenario 2 assertion: 720,000ms yields exactly 0.2 hrs", () => {
      // 210,000 + 210,000 + 300,000 = 720,000 ms = 0.20 hrs
      const history: PlaybackHistoryItem[] = [
        makeHistoryItem(210000, "trk_1"),
        makeHistoryItem(210000, "trk_1"),
        makeHistoryItem(300000, "trk_2"),
      ];

      const stats = computeListeningStats(history);
      expect(stats.totalHoursListened).toBe(0.2);
    });

    it("computes exact expected decimal values across standard durations", () => {
      // 360,000 ms = 0.10 hr
      expect(computeListeningStats([makeHistoryItem(360000)]).totalHoursListened).toBe(0.1);

      // 1,800,000 ms = 0.50 hr
      expect(computeListeningStats([makeHistoryItem(1800000)]).totalHoursListened).toBe(0.5);

      // 3,600,000 ms = 1.00 hr
      expect(computeListeningStats([makeHistoryItem(3600000)]).totalHoursListened).toBe(1);

      // 5,400,000 ms = 1.50 hr
      expect(computeListeningStats([makeHistoryItem(5400000)]).totalHoursListened).toBe(1.5);

      // 36,000 ms = 0.01 hr
      expect(computeListeningStats([makeHistoryItem(36000)]).totalHoursListened).toBe(0.01);

      // 3,600 ms = 0.001 hr -> rounds to 0.00
      expect(computeListeningStats([makeHistoryItem(3600)]).totalHoursListened).toBe(0);
    });

    it("honors custom precision option across multi-scale configurations", () => {
      // 690,000 / 3,600,000 = 0.1916666...
      const history = [makeHistoryItem(690000)];

      expect(computeListeningStats(history, { precision: 0 }).totalHoursListened).toBe(0);
      expect(computeListeningStats(history, { precision: 1 }).totalHoursListened).toBe(0.2);
      expect(computeListeningStats(history, { precision: 2 }).totalHoursListened).toBe(0.19);
      expect(computeListeningStats(history, { precision: 3 }).totalHoursListened).toBe(0.192);
      expect(computeListeningStats(history, { precision: 4 }).totalHoursListened).toBe(0.1917);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Extreme & Hostile Duration Values
  // --------------------------------------------------------------------------
  describe("3. Extreme & Hostile Duration Values", () => {
    const dummyTrack: Track = {
      id: "trk_extreme",
      title: "Edge Song",
      artists: "Stress Band",
      durationMs: 200000,
      coverUrl: "",
      playCount: 0,
    };

    function makeAdversarialItem(durationValue: any): PlaybackHistoryItem {
      return {
        id: "h_adv",
        playbackSessionId: "s1",
        listeningSessionId: "l1",
        track: dummyTrack,
        playedDurationMs: durationValue,
        completionRate: 0,
        completed: false,
        skipped: true,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-23T00:00:00Z",
      };
    }

    it("discards negative duration values without polluting aggregate or throwing", () => {
      const history = [
        makeAdversarialItem(-50000),
        makeAdversarialItem(-1),
        makeAdversarialItem(-Number.MAX_SAFE_INTEGER),
        makeAdversarialItem(3600000), // 1 hour valid
      ];

      const stats = computeListeningStats(history);
      expect(stats.totalHoursListened).toBe(1);
      expect(stats.totalTracksPlayed).toBe(4);
      expect(stats.topTracks[0].totalPlayedMs).toBe(3600000);
    });

    it("discards NaN duration values safely", () => {
      const history = [
        makeAdversarialItem(NaN),
        makeAdversarialItem(Number("not-a-number")),
        makeAdversarialItem(3600000),
      ];

      const stats = computeListeningStats(history);
      expect(stats.totalHoursListened).toBe(1);
      expect(Number.isNaN(stats.totalHoursListened)).toBe(false);
    });

    it("discards non-numeric duration types (string, object, array, boolean, null)", () => {
      const history = [
        makeAdversarialItem("3600000"),
        makeAdversarialItem({ ms: 3600000 }),
        makeAdversarialItem([3600000]),
        makeAdversarialItem(true),
        makeAdversarialItem(null),
        makeAdversarialItem(undefined),
        makeAdversarialItem(1800000), // 0.5 hr
      ];

      const stats = computeListeningStats(history);
      expect(stats.totalHoursListened).toBe(0.5);
      expect(stats.totalTracksPlayed).toBe(7);
      expect(stats.topTracks[0].totalPlayedMs).toBe(1800000);
    });

    it("safely handles 0 duration items without creating NaN", () => {
      const history = [makeAdversarialItem(0), makeAdversarialItem(0)];

      const stats = computeListeningStats(history);
      expect(stats.totalHoursListened).toBe(0);
      expect(stats.topTracks[0].totalPlayedMs).toBe(0);
      expect(stats.topTracks[0].playCount).toBe(2);
    });
    it("handles Infinity and -Infinity playedDurationMs values", () => {
      const history = [
        makeAdversarialItem(Infinity),
        makeAdversarialItem(-Infinity),
      ];

      const stats = computeListeningStats(history);
      // Negative infinity is discarded (< 0); positive infinity is propagated as Infinity
      expect(stats.totalHoursListened).toBe(Infinity);
      expect(Number.isNaN(stats.totalHoursListened)).toBe(false);
      expect(stats.topTracks[0].totalPlayedMs).toBe(Infinity);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Large-Scale Stress Harness (10,000+ Tracks)
  // --------------------------------------------------------------------------
  describe("4. Large-Scale Stress Testing (10,000+ tracks)", () => {
    it("processes 10,000 tracks within 50ms and computes exact aggregates", () => {
      const trackPoolCount = 500;
      const artistPoolCount = 50;

      const tracks: Track[] = Array.from({ length: trackPoolCount }, (_, i) => ({
        id: `trk_pool_${i}`,
        title: `Track ${i.toString().padStart(4, "0")}`,
        artists: `Artist ${(i % artistPoolCount).toString().padStart(3, "0")}`,
        durationMs: 180000 + (i % 60) * 1000,
        coverUrl: "",
        playCount: 0,
      }));

      let expectedTotalMs = 0;
      const totalItems = 10000;
      const history: PlaybackHistoryItem[] = new Array(totalItems);

      for (let i = 0; i < totalItems; i++) {
        const track = tracks[i % trackPoolCount];
        const playedMs = 60000 + (i % 120) * 1000; // between 60k and 179k ms
        expectedTotalMs += playedMs;

        history[i] = {
          id: `hist_${i}`,
          playbackSessionId: `session_${i % 100}`,
          listeningSessionId: `listen_${i % 20}`,
          track,
          playedDurationMs: playedMs,
          completionRate: 0.9,
          completed: true,
          skipped: false,
          loopCount: 0,
          hasSeekBackward: false,
          listenedAt: new Date(1700000000000 + i * 60000).toISOString(),
        };
      }

      const startTime = performance.now();
      const stats = computeListeningStats(history);
      const elapsedMs = performance.now() - startTime;

      // Assert high performance
      expect(elapsedMs).toBeLessThan(150); // Generous margin, typically < 30ms

      // Assert data accuracy
      expect(stats.totalTracksPlayed).toBe(totalItems);
      const expectedHours = Math.round((expectedTotalMs / (1000 * 60 * 60)) * 100) / 100;
      expect(stats.totalHoursListened).toBe(expectedHours);

      // Assert top lists are properly bounded
      expect(stats.topTracks).toHaveLength(10);
      expect(stats.topArtists).toHaveLength(10);

      // Verify descending ordering invariant on top tracks
      for (let i = 0; i < stats.topTracks.length - 1; i++) {
        const curr = stats.topTracks[i];
        const next = stats.topTracks[i + 1];
        if (curr.playCount === next.playCount) {
          expect(curr.totalPlayedMs).toBeGreaterThanOrEqual(next.totalPlayedMs);
        } else {
          expect(curr.playCount).toBeGreaterThan(next.playCount);
        }
      }

      // Verify descending ordering invariant on top artists
      for (let i = 0; i < stats.topArtists.length - 1; i++) {
        const curr = stats.topArtists[i];
        const next = stats.topArtists[i + 1];
        expect(curr.playCount).toBeGreaterThanOrEqual(next.playCount);
      }
    });

    it("processes 25,000 tracks without memory degradation or timeout", () => {
      const history: PlaybackHistoryItem[] = Array.from({ length: 25000 }, (_, i) => ({
        id: `h_heavy_${i}`,
        playbackSessionId: "s",
        listeningSessionId: "l",
        track: {
          id: `trk_${i % 1000}`,
          title: `Song ${i % 1000}`,
          artists: `Band ${i % 100}`,
          durationMs: 200000,
          coverUrl: "",
          playCount: 0,
        },
        playedDurationMs: 120000,
        completionRate: 0.6,
        completed: false,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-23T00:00:00Z",
      }));

      const startTime = performance.now();
      const stats = computeListeningStats(history);
      const elapsedMs = performance.now() - startTime;

      expect(elapsedMs).toBeLessThan(350);
      expect(stats.totalTracksPlayed).toBe(25000);
      // 25,000 * 120,000 = 3,000,000,000 ms / 3,600,000 = 833.33 hrs
      expect(stats.totalHoursListened).toBe(833.33);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Deterministic Multi-Tier Tie-Breaking
  // --------------------------------------------------------------------------
  describe("5. Deterministic Multi-Tier Tie-Breaking", () => {
    it("breaks track ties by playCount DESC, then totalPlayedMs DESC, then title ASC", () => {
      const track1: Track = { id: "t1", title: "Zebra Song", artists: "Band", durationMs: 200000, coverUrl: "", playCount: 0 };
      const track2: Track = { id: "t2", title: "Alpha Song", artists: "Band", durationMs: 200000, coverUrl: "", playCount: 0 };
      const track3: Track = { id: "t3", title: "Middle Song", artists: "Band", durationMs: 200000, coverUrl: "", playCount: 0 };

      // Case 1: Same play count (1 each), but different playedDurationMs
      const historyDurationTie: PlaybackHistoryItem[] = [
        { id: "1", playbackSessionId: "1", listeningSessionId: "1", track: track1, playedDurationMs: 100000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
        { id: "2", playbackSessionId: "2", listeningSessionId: "1", track: track2, playedDurationMs: 300000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
        { id: "3", playbackSessionId: "3", listeningSessionId: "1", track: track3, playedDurationMs: 200000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
      ];

      const statsDuration = computeListeningStats(historyDurationTie);
      // Expected order: t2 (300k ms) -> t3 (200k ms) -> t1 (100k ms)
      expect(statsDuration.topTracks[0].track.id).toBe("t2");
      expect(statsDuration.topTracks[1].track.id).toBe("t3");
      expect(statsDuration.topTracks[2].track.id).toBe("t1");

      // Case 2: Same play count (1 each) AND same totalPlayedMs (200k each) -> alphabetical by title ASC
      const historyTitleTie: PlaybackHistoryItem[] = [
        { id: "1", playbackSessionId: "1", listeningSessionId: "1", track: track1, playedDurationMs: 200000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
        { id: "2", playbackSessionId: "2", listeningSessionId: "1", track: track2, playedDurationMs: 200000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
        { id: "3", playbackSessionId: "3", listeningSessionId: "1", track: track3, playedDurationMs: 200000, completionRate: 1, completed: true, skipped: false, loopCount: 0, hasSeekBackward: false, listenedAt: "" },
      ];

      const statsTitle = computeListeningStats(historyTitleTie);
      // Expected alphabetical order: "Alpha Song" (t2) -> "Middle Song" (t3) -> "Zebra Song" (t1)
      expect(statsTitle.topTracks[0].track.id).toBe("t2");
      expect(statsTitle.topTracks[0].track.title).toBe("Alpha Song");
      expect(statsTitle.topTracks[1].track.id).toBe("t3");
      expect(statsTitle.topTracks[1].track.title).toBe("Middle Song");
      expect(statsTitle.topTracks[2].track.id).toBe("t1");
      expect(statsTitle.topTracks[2].track.title).toBe("Zebra Song");
    });

    it("breaks artist ties by playCount DESC, then artistName ASC", () => {
      const makeArtistItem = (name: string, id: string): PlaybackHistoryItem => ({
        id: `h_${id}`,
        playbackSessionId: "s",
        listeningSessionId: "l",
        track: { id, title: `Song ${id}`, artists: name, durationMs: 180000, coverUrl: "", playCount: 0 },
        playedDurationMs: 180000,
        completionRate: 1,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "",
      });

      // Artists with same play count = 1
      const history: PlaybackHistoryItem[] = [
        makeArtistItem("The Postal Service", "1"),
        makeArtistItem("Bon Iver", "2"),
        makeArtistItem("Air", "3"),
        makeArtistItem("Zero 7", "4"),
      ];

      const stats = computeListeningStats(history);
      // Expected alphabetical order: "Air" -> "Bon Iver" -> "The Postal Service" -> "Zero 7"
      expect(stats.topArtists[0].artistName).toBe("Air");
      expect(stats.topArtists[1].artistName).toBe("Bon Iver");
      expect(stats.topArtists[2].artistName).toBe("The Postal Service");
      expect(stats.topArtists[3].artistName).toBe("Zero 7");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Immutability Verification (Object.freeze)
  // --------------------------------------------------------------------------
  describe("6. Immutability Verification (Object.freeze)", () => {
    it("guarantees input history array, item objects, and track references are not mutated", () => {
      const originalTrack: Track = Object.freeze({
        id: "trk_frozen",
        title: "Frozen Glacier",
        artists: "Sub Zero",
        durationMs: 240000,
        coverUrl: "https://liner.fun/subzero.jpg",
        playCount: 5,
      });

      const originalItem: PlaybackHistoryItem = Object.freeze({
        id: "hist_frozen_1",
        playbackSessionId: "sess_f1",
        listeningSessionId: "list_f1",
        track: originalTrack,
        playedDurationMs: 240000,
        completionRate: 1.0,
        completed: true,
        skipped: false,
        loopCount: 0,
        hasSeekBackward: false,
        listenedAt: "2026-10-23T10:00:00Z",
      });

      const historyArray: PlaybackHistoryItem[] = Object.freeze([originalItem]) as PlaybackHistoryItem[];
      const options = Object.freeze({ precision: 2, topLimit: 5 });

      // If computeListeningStats mutates array, item, or track, Object.freeze will throw in strict mode
      let statsResult: any;
      expect(() => {
        statsResult = computeListeningStats(historyArray, options);
      }).not.toThrow();

      // Deep invariant verification: original object properties unchanged
      expect(originalItem.playedDurationMs).toBe(240000);
      expect(originalItem.track.id).toBe("trk_frozen");
      expect(originalItem.track.playCount).toBe(5);
      expect(historyArray.length).toBe(1);

      // Verify result correctly calculated without polluting original
      expect(statsResult.totalTracksPlayed).toBe(1);
      expect(statsResult.topTracks[0].playCount).toBe(1); // Stats playCount is 1, original track.playCount remains 5
      expect(originalTrack.playCount).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Artist Extraction & Formatting Edge Cases
  // --------------------------------------------------------------------------
  describe("7. Artist Extraction & UI Formatting Edge Cases", () => {
    it("handles diverse artist field representations (string, object array, string array, artistList)", () => {
      expect(extractArtistName({ artists: "M83" })).toBe("M83");
      expect(extractArtistName({ artists: "  HOME  " })).toBe("HOME");
      expect(extractArtistName({ artists: ["Daft Punk", "Pharrell Williams"] })).toBe("Daft Punk, Pharrell Williams");
      expect(extractArtistName({ artists: [{ name: "Porter Robinson" }, { name: "Madeon" }] })).toBe("Porter Robinson, Madeon");
      expect(extractArtistName({ artistList: [{ name: "Tycho" }] })).toBe("Tycho");
      expect(extractArtistName({ artists: "   " })).toBe("Unknown Artist");
      expect(extractArtistName({ artists: [] })).toBe("Unknown Artist");
      expect(extractArtistName({})).toBe("Unknown Artist");
      expect(extractArtistName(null)).toBe("Unknown Artist");
      expect(extractArtistName(undefined)).toBe("Unknown Artist");
      expect(extractArtistName(12345)).toBe("Unknown Artist");
    });

    it("formats hours cleanly for UI across edge cases", () => {
      expect(formatListeningHours(0)).toBe("0 hrs");
      expect(formatListeningHours(-5)).toBe("0 hrs");
      expect(formatListeningHours(NaN)).toBe("0 hrs");
      expect(formatListeningHours(0.19)).toBe("0.2 hrs");
      expect(formatListeningHours(0.2)).toBe("0.2 hrs");
      expect(formatListeningHours(125.75)).toBe("125.8 hrs");
    });
  });
});
