import { describe, it, expect } from "vitest";
import {
  parseLrc,
  getActiveLyricIndex,
  computeLyricScrollOffset,
  computeLrcDurations,
  type SyncedLrcLine,
} from "./lrcParser";

describe("lrcParser engine", () => {
  describe("parseLrc", () => {
    it("parses standard LRC lines with centiseconds and milliseconds", () => {
      const lrcContent = `
        [00:05.10]Welcome to the night
        [00:12.80]Neon lights are glowing bright
        [00:24.005]Cruising down the highway
      `;

      const parsed = parseLrc(lrcContent);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({
        id: "line_0",
        timeMs: 5100,
        text: "Welcome to the night",
      });
      expect(parsed[1]).toEqual({
        id: "line_1",
        timeMs: 12800,
        text: "Neon lights are glowing bright",
      });
      expect(parsed[2]).toEqual({
        id: "line_2",
        timeMs: 24005,
        text: "Cruising down the highway",
      });
    });

    it("returns empty array for empty, non-string, or plain un-synced text", () => {
      expect(parseLrc("")).toEqual([]);
      expect(parseLrc("   \n\n  ")).toEqual([]);
      expect(parseLrc(null as any)).toEqual([]);
      expect(parseLrc(undefined as any)).toEqual([]);
      expect(parseLrc("Just plain text with no timestamps\nSecond line")).toEqual([]);
    });

    it("filters out malformed timestamp tags and metadata tags safely", () => {
      const lrc = `
        [ar:Synth Master]
        [ti:Cyber City]
        [al:Future Retro]
        [00:02.00]Valid line 1
        [not:a.time]Malformed line
        [99:99.9999]Excessive digits
        [00:10.50]Valid line 2
      `;

      const parsed = parseLrc(lrc);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        id: "line_0",
        timeMs: 2000,
        text: "Valid line 1",
      });
      expect(parsed[1]).toEqual({
        id: "line_1",
        timeMs: 10500,
        text: "Valid line 2",
      });
    });

    it("applies [offset:+/-ms] tag to timestamps and clamps at 0", () => {
      const positiveOffsetLrc = `
        [offset:+500]
        [00:01.00]Shifted forward
      `;
      const parsedPos = parseLrc(positiveOffsetLrc);
      expect(parsedPos).toHaveLength(1);
      expect(parsedPos[0].timeMs).toBe(1500);

      const negativeOffsetLrc = `
        [offset:-2000]
        [00:01.00]Shifted backward clamped
        [00:05.00]Shifted backward valid
      `;
      const parsedNeg = parseLrc(negativeOffsetLrc);
      expect(parsedNeg).toHaveLength(2);
      expect(parsedNeg[0].timeMs).toBe(0); // Clamped from -1000 to 0
      expect(parsedNeg[1].timeMs).toBe(3000); // 5000 - 2000
    });

    it("supports multiple timestamp tags on a single line and sorts chronologically", () => {
      const multiTagLrc = `
        [00:10.00][00:02.00]Repeated refrain
      `;
      const parsed = parseLrc(multiTagLrc);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        id: "line_0",
        timeMs: 2000,
        text: "Repeated refrain",
      });
      expect(parsed[1]).toEqual({
        id: "line_1",
        timeMs: 10000,
        text: "Repeated refrain",
      });
    });
  });

  describe("getActiveLyricIndex", () => {
    const lines: SyncedLrcLine[] = [
      { id: "line_0", timeMs: 5000, text: "Line 1" },
      { id: "line_1", timeMs: 10000, text: "Line 2" },
      { id: "line_2", timeMs: 20000, text: "Line 3" },
    ];

    it("returns -1 for empty list or position before first line", () => {
      expect(getActiveLyricIndex([], 5000)).toBe(-1);
      expect(getActiveLyricIndex(lines, 0)).toBe(-1);
      expect(getActiveLyricIndex(lines, 4999)).toBe(-1);
    });

    it("returns appropriate line index for intermediate positions", () => {
      expect(getActiveLyricIndex(lines, 5000)).toBe(0);
      expect(getActiveLyricIndex(lines, 7500)).toBe(0);
      expect(getActiveLyricIndex(lines, 9999)).toBe(0);
      expect(getActiveLyricIndex(lines, 10000)).toBe(1);
      expect(getActiveLyricIndex(lines, 15000)).toBe(1);
      expect(getActiveLyricIndex(lines, 19999)).toBe(1);
    });

    it("returns last index for position at or beyond last line", () => {
      expect(getActiveLyricIndex(lines, 20000)).toBe(2);
      expect(getActiveLyricIndex(lines, 999999)).toBe(2);
    });
  });

  describe("computeLyricScrollOffset", () => {
    it("returns 0 when activeIndex is negative", () => {
      expect(computeLyricScrollOffset(-1, 48, 300)).toBe(0);
    });

    it("computes centered vertical scroll offset", () => {
      const lineHeightPx = 48;
      const viewportHeightPx = 300;
      const activeIndex = 4;

      // 4 * 48 - 150 + 24 = 66
      expect(computeLyricScrollOffset(activeIndex, lineHeightPx, viewportHeightPx)).toBe(66);

      // First line: 0 * 48 - 150 + 24 = -126 -> clamped to 0
      expect(computeLyricScrollOffset(0, lineHeightPx, viewportHeightPx)).toBe(0);
    });
  });

  describe("computeLrcDurations", () => {
    it("computes durationMs based on next line's timestamp", () => {
      const lines: SyncedLrcLine[] = [
        { id: "0", timeMs: 1000, text: "Line 1" },
        { id: "1", timeMs: 4000, text: "Line 2" },
        { id: "2", timeMs: 10000, text: "Line 3" },
      ];

      const withDurations = computeLrcDurations(lines, 15000);
      expect(withDurations[0].durationMs).toBe(3000);
      expect(withDurations[1].durationMs).toBe(6000);
      expect(withDurations[2].durationMs).toBe(5000); // 15000 - 10000
    });
  });
});
