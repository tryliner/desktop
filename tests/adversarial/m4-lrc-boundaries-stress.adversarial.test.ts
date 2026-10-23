import { describe, it, expect } from "vitest";
import {
  parseLrc,
  getActiveLyricIndex,
  computeLyricScrollOffset,
  computeLrcDurations,
  type SyncedLrcLine,
} from "@/features/lyrics/engine/lrcParser";

describe("Adversarial Stress Harness: LRC Boundaries & Stress (M4.1)", () => {
  // ---------------------------------------------------------------------------
  // 1. Extreme Input Benchmark (10,000 lines < 100ms)
  // ---------------------------------------------------------------------------
  describe("1. Extreme Input Parsing Benchmark", () => {
    it("parses 10,000 lines of LRC content in < 100ms", () => {
      const lineCount = 10000;
      const rawLines: string[] = [];

      for (let i = 0; i < lineCount; i++) {
        const mins = Math.floor(i / 60)
          .toString()
          .padStart(2, "0");
        const secs = (i % 60).toString().padStart(2, "0");
        const cs = (i % 100).toString().padStart(2, "0");
        rawLines.push(`[${mins}:${secs}.${cs}]Stress lyric line sequence #${i}`);
      }

      const hugeLrc = rawLines.join("\n");

      const t0 = performance.now();
      const parsed = parseLrc(hugeLrc);
      const elapsedMs = performance.now() - t0;

      console.log(`[PERF] Parsed ${lineCount} LRC lines in ${elapsedMs.toFixed(2)}ms`);

      expect(elapsedMs).toBeLessThan(100);
      expect(parsed).toHaveLength(lineCount);
      expect(parsed[0].id).toBe("line_0");
      expect(parsed[0].timeMs).toBe(0);
      expect(parsed[lineCount - 1].id).toBe(`line_${lineCount - 1}`);
      expect(parsed[lineCount - 1].text).toBe(`Stress lyric line sequence #${lineCount - 1}`);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Out-of-order Timestamps & Sorting
  // ---------------------------------------------------------------------------
  describe("2. Chronological Sorting & Out-of-Order Timestamps", () => {
    it("ensures parsed output is strictly ascending by timeMs when input is in reverse order", () => {
      const reverseLrc = `
        [03:00.00]Third line
        [02:00.00]Second line
        [01:00.00]First line
        [00:10.00]Zero line
      `;

      const parsed = parseLrc(reverseLrc);
      expect(parsed).toHaveLength(4);
      expect(parsed[0].timeMs).toBe(10000);
      expect(parsed[0].text).toBe("Zero line");
      expect(parsed[0].id).toBe("line_0");

      expect(parsed[1].timeMs).toBe(60000);
      expect(parsed[1].text).toBe("First line");
      expect(parsed[1].id).toBe("line_1");

      expect(parsed[2].timeMs).toBe(120000);
      expect(parsed[2].text).toBe("Second line");

      expect(parsed[3].timeMs).toBe(180000);
      expect(parsed[3].text).toBe("Third line");
    });

    it("ensures parsed output is sorted ascending for randomly shuffled timestamps (1,000 lines)", () => {
      const count = 1000;
      const timestamps: number[] = [];
      for (let i = 0; i < count; i++) {
        timestamps.push(i * 250); // every 250ms
      }

      // Fisher-Yates shuffle
      const shuffled = [...timestamps];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const lrcLines = shuffled.map((ms) => {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60)
          .toString()
          .padStart(2, "0");
        const secs = (totalSecs % 60).toString().padStart(2, "0");
        const cs = Math.floor((ms % 1000) / 10)
          .toString()
          .padStart(2, "0");
        return `[${mins}:${secs}.${cs}]Lyric at ${ms}ms`;
      });

      const parsed = parseLrc(lrcLines.join("\n"));
      expect(parsed).toHaveLength(count);

      for (let i = 0; i < parsed.length - 1; i++) {
        expect(parsed[i].timeMs).toBeLessThanOrEqual(parsed[i + 1].timeMs);
        expect(parsed[i].id).toBe(`line_${i}`);
      }
      expect(parsed[parsed.length - 1].id).toBe(`line_${count - 1}`);
    });

    it("handles identical timestamps gracefully without reordering anomalies or missing lines", () => {
      const identicalLrc = `
        [00:05.00]Simultaneous line A
        [00:05.00]Simultaneous line B
        [00:05.00]Simultaneous line C
      `;

      const parsed = parseLrc(identicalLrc);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].timeMs).toBe(5000);
      expect(parsed[1].timeMs).toBe(5000);
      expect(parsed[2].timeMs).toBe(5000);
      expect(parsed.map((p) => p.id)).toEqual(["line_0", "line_1", "line_2"]);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Multiple Timestamps Per Line
  // ---------------------------------------------------------------------------
  describe("3. Multiple Timestamps per Line Expansion & Sorting", () => {
    it("correctly expands and sorts multi-timestamp lines", () => {
      const multiTagLrc = `[00:01.00][00:03.50][00:07.20]Repetitive Chorus`;
      const parsed = parseLrc(multiTagLrc);

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({
        id: "line_0",
        timeMs: 1000,
        text: "Repetitive Chorus",
      });
      expect(parsed[1]).toEqual({
        id: "line_1",
        timeMs: 3500,
        text: "Repetitive Chorus",
      });
      expect(parsed[2]).toEqual({
        id: "line_2",
        timeMs: 7200,
        text: "Repetitive Chorus",
      });
    });

    it("correctly handles multi-timestamp lines with out-of-order tags", () => {
      const outOfOrderMultiTag = `[00:07.20][00:01.00][00:03.50]Out of order chorus`;
      const parsed = parseLrc(outOfOrderMultiTag);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].timeMs).toBe(1000);
      expect(parsed[1].timeMs).toBe(3500);
      expect(parsed[2].timeMs).toBe(7200);
      expect(parsed.every((l) => l.text === "Out of order chorus")).toBe(true);
    });

    it("expands a single line with 20 repetitive chorus timestamp tags", () => {
      const tags = Array.from({ length: 20 }, (_, i) => {
        const secs = (i * 2).toString().padStart(2, "0");
        return `[00:${secs}.00]`;
      }).join("");

      const content = `${tags}Hyper repetitive line`;
      const parsed = parseLrc(content);

      expect(parsed).toHaveLength(20);
      for (let i = 0; i < 20; i++) {
        expect(parsed[i].timeMs).toBe(i * 2000);
        expect(parsed[i].text).toBe("Hyper repetitive line");
        expect(parsed[i].id).toBe(`line_${i}`);
      }
    });

    it("handles mixed multi-tag lines and single-tag lines seamlessly", () => {
      const mixed = `
        [00:02.00]Verse 1
        [00:05.00][00:15.00]Refrain
        [00:10.00]Verse 2
      `;
      const parsed = parseLrc(mixed);
      expect(parsed).toHaveLength(4);
      expect(parsed[0]).toEqual({ id: "line_0", timeMs: 2000, text: "Verse 1" });
      expect(parsed[1]).toEqual({ id: "line_1", timeMs: 5000, text: "Refrain" });
      expect(parsed[2]).toEqual({ id: "line_2", timeMs: 10000, text: "Verse 2" });
      expect(parsed[3]).toEqual({ id: "line_3", timeMs: 15000, text: "Refrain" });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Global [offset:+/-ms] Tags
  // ---------------------------------------------------------------------------
  describe("4. Global [offset:+/-ms] Tag Variations & Summation", () => {
    it("shifts forward with positive offset", () => {
      const lrc = `
        [offset:+750]
        [00:01.00]Forward
      `;
      const parsed = parseLrc(lrc);
      expect(parsed[0].timeMs).toBe(1750);
    });

    it("shifts backward and clamps at 0ms with negative offset", () => {
      const lrc = `
        [offset:-3000]
        [00:01.00]Underflow clamped to zero
        [00:05.00]Shifted backward valid
      `;
      const parsed = parseLrc(lrc);
      expect(parsed[0].timeMs).toBe(0); // 1000 - 3000 = -2000 -> clamped to 0
      expect(parsed[1].timeMs).toBe(2000); // 5000 - 3000 = 2000
    });

    it("sums multiple offset tags across the file regardless of placement", () => {
      const lrc = `
        [offset:+500]
        [00:01.00]First line
        [offset:-200]
        [00:05.00]Second line
        [offset:+100]
      `;
      // Net offset: 500 - 200 + 100 = +400ms
      const parsed = parseLrc(lrc);
      expect(parsed[0].timeMs).toBe(1400); // 1000 + 400
      expect(parsed[1].timeMs).toBe(5400); // 5000 + 400
    });

    it("handles whitespace and case variations in offset tags", () => {
      const lrc = `
        [OFFSET:   +250   ]
        [00:02.00]Case insensitive test
      `;
      const parsed = parseLrc(lrc);
      expect(parsed[0].timeMs).toBe(2250);
    });

    it("safely ignores malformed offset tags without throwing or producing NaN", () => {
      const lrc = `
        [offset:not-a-number]
        [offset:]
        [00:02.00]Valid line
      `;
      const parsed = parseLrc(lrc);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].timeMs).toBe(2000);
      expect(Number.isNaN(parsed[0].timeMs)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Malformed Timestamp Edge Cases
  // ---------------------------------------------------------------------------
  describe("5. Malformed Timestamp Edge Cases & Unicode", () => {
    it("filters out tags with 4 fractional digits like [99:99.9999]", () => {
      const lrc = `[99:99.9999]Too many fractional digits`;
      expect(parseLrc(lrc)).toEqual([]);
    });

    it("safely handles placeholder tags like [--:--.--]", () => {
      const lrc = `[--:--.--]Placeholder un-synced line`;
      expect(parseLrc(lrc)).toEqual([]);
    });

    it("filters out colons instead of dots like [00:00:00]", () => {
      const lrc = `[00:00:00]Colons only tag`;
      expect(parseLrc(lrc)).toEqual([]);
    });

    it("investigates [00:65.00] seconds overflow behavior", () => {
      const lrc = `[00:65.00]Overflow seconds tag`;
      const parsed = parseLrc(lrc);
      console.log("[EMPIRICAL] [00:65.00] parsed as:", parsed);
      // Let's document exact behavior
      if (parsed.length > 0) {
        // Parsed as 65000ms
        expect(parsed[0].timeMs).toBe(65000);
      } else {
        expect(parsed).toEqual([]);
      }
    });

    it("filters corrupted brackets safely", () => {
      const badBrackets = `
        [00:01.00 Unclosed bracket
        00:02.00] Unopened bracket
        [] Empty tag
        [::.] Symbols only
        [[00:03.00]] Double brackets
      `;
      const parsed = parseLrc(badBrackets);
      console.log("[EMPIRICAL] bad brackets parsed as:", parsed);
      // Double brackets match the inner [00:03.00]
      // Ensure no crash and valid timestamps only
      for (const p of parsed) {
        expect(Number.isNaN(p.timeMs)).toBe(false);
        expect(p.timeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("preserves non-ASCII Unicode lyrics (Japanese, Arabic RTL, Emojis, Accented)", () => {
      const unicodeLrc = `
        [00:01.00]夜に駆ける 沈むように溶けてゆくように
        [00:02.50]أنت عمري الذي ابتدأ بنورك صباحه
        [00:04.00]🎵 Streaming in 24-bit 96kHz 🎧 ✨
        [00:06.00]Hélène et les garçons — déjà vu café
        [00:08.00]Привет мир! Проверка синхронизации
      `;

      const parsed = parseLrc(unicodeLrc);
      expect(parsed).toHaveLength(5);
      expect(parsed[0].text).toBe("夜に駆ける 沈むように溶けてゆくように");
      expect(parsed[1].text).toBe("أنت عمري الذي ابتدأ بنورك صباحه");
      expect(parsed[2].text).toBe("🎵 Streaming in 24-bit 96kHz 🎧 ✨");
      expect(parsed[3].text).toBe("Hélène et les garçons — déjà vu café");
      expect(parsed[4].text).toBe("Привет мир! Проверка синхронизации");
    });

    it("handles large minute timestamps [999:00.00]", () => {
      const lrc = `[999:00.00]End of long track`;
      const parsed = parseLrc(lrc);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].timeMs).toBe(999 * 60 * 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. getActiveLyricIndex Benchmark & Boundary Tests
  // ---------------------------------------------------------------------------
  describe("6. getActiveLyricIndex Benchmark & Boundary Precision", () => {
    const lines: SyncedLrcLine[] = [
      { id: "line_0", timeMs: 1000, text: "Intro" },
      { id: "line_1", timeMs: 5000, text: "Verse 1" },
      { id: "line_2", timeMs: 10000, text: "Chorus" },
      { id: "line_3", timeMs: 25000, text: "Outro" },
    ];

    it("benchmarks 10,000 queries on 100-line realistic song in < 20ms", () => {
      // 100-line realistic song
      const songLines: SyncedLrcLine[] = Array.from({ length: 100 }, (_, i) => ({
        id: `line_${i}`,
        timeMs: i * 3000,
        text: `Song line #${i}`,
      }));

      const queryCount = 10000;
      const queryPositions = Array.from({ length: queryCount }, () =>
        Math.floor(Math.random() * 320000),
      );

      const t0 = performance.now();
      for (let i = 0; i < queryCount; i++) {
        getActiveLyricIndex(songLines, queryPositions[i]);
      }
      const elapsedMs = performance.now() - t0;

      console.log(`[PERF] 10,000 queries on 100 lines took ${elapsedMs.toFixed(2)}ms`);
      expect(elapsedMs).toBeLessThan(20);
    });

    it("evaluates query performance scaling on 1,000-line extreme song", () => {
      const songLines: SyncedLrcLine[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `line_${i}`,
        timeMs: i * 500,
        text: `Song line #${i}`,
      }));

      const queryCount = 10000;
      const queryPositions = Array.from({ length: queryCount }, () =>
        Math.floor(Math.random() * 520000),
      );

      const t0 = performance.now();
      for (let i = 0; i < queryCount; i++) {
        getActiveLyricIndex(songLines, queryPositions[i]);
      }
      const elapsedMs = performance.now() - t0;

      console.log(`[PERF] 10,000 queries on 1,000 lines took ${elapsedMs.toFixed(2)}ms`);
    });

    it("precisely handles boundary - 1ms, exact boundary, and boundary + 1ms", () => {
      // Before first line (boundary - 1ms)
      expect(getActiveLyricIndex(lines, 999)).toBe(-1);
      // Exact boundary first line
      expect(getActiveLyricIndex(lines, 1000)).toBe(0);
      // Boundary + 1ms first line
      expect(getActiveLyricIndex(lines, 1001)).toBe(0);

      // Boundary - 1ms second line
      expect(getActiveLyricIndex(lines, 4999)).toBe(0);
      // Exact boundary second line
      expect(getActiveLyricIndex(lines, 5000)).toBe(1);
      // Boundary + 1ms second line
      expect(getActiveLyricIndex(lines, 5001)).toBe(1);

      // Boundary - 1ms third line
      expect(getActiveLyricIndex(lines, 9999)).toBe(1);
      // Exact boundary third line
      expect(getActiveLyricIndex(lines, 10000)).toBe(2);
      // Boundary + 1ms third line
      expect(getActiveLyricIndex(lines, 10001)).toBe(2);

      // Last line boundary
      expect(getActiveLyricIndex(lines, 24999)).toBe(2);
      expect(getActiveLyricIndex(lines, 25000)).toBe(3);
      expect(getActiveLyricIndex(lines, 25001)).toBe(3);
      expect(getActiveLyricIndex(lines, 999999)).toBe(3);
    });

    it("handles negative positions safely", () => {
      expect(getActiveLyricIndex(lines, -1)).toBe(-1);
      expect(getActiveLyricIndex(lines, -50000)).toBe(-1);
      expect(getActiveLyricIndex(lines, -Infinity)).toBe(-1);
    });

    it("handles NaN, null, and undefined positions safely", () => {
      expect(getActiveLyricIndex(lines, NaN)).toBe(-1);
      expect(getActiveLyricIndex(lines, undefined as any)).toBe(-1);
      expect(getActiveLyricIndex(lines, null as any)).toBe(-1);
    });

    it("handles empty array safely", () => {
      expect(getActiveLyricIndex([], 0)).toBe(-1);
      expect(getActiveLyricIndex([], 5000)).toBe(-1);
      expect(getActiveLyricIndex(null as any, 5000)).toBe(-1);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Centered Scroll Offset Math
  // ---------------------------------------------------------------------------
  describe("7. Centered Scroll Offset Math (computeLyricScrollOffset)", () => {
    it("returns 0 for negative active index", () => {
      expect(computeLyricScrollOffset(-1, 48, 600)).toBe(0);
      expect(computeLyricScrollOffset(-100, 48, 600)).toBe(0);
    });

    it("computes exact centered pixel offsets for typical viewport sizes", () => {
      const lineHeight = 48;
      const viewport = 400;

      // activeIndex = 0: 0*48 - 200 + 24 = -176 -> clamped to 0
      expect(computeLyricScrollOffset(0, lineHeight, viewport)).toBe(0);

      // activeIndex = 4: 4*48 - 200 + 24 = 192 - 200 + 24 = 16
      expect(computeLyricScrollOffset(4, lineHeight, viewport)).toBe(16);

      // activeIndex = 10: 10*48 - 200 + 24 = 480 - 200 + 24 = 304
      expect(computeLyricScrollOffset(10, lineHeight, viewport)).toBe(304);
    });

    it("handles extreme viewport sizes without negative return values", () => {
      const lineHeight = 48;

      // Huge viewport (e.g. 4K vertical screen 2160px)
      // activeIndex = 2: 2*48 - 1080 + 24 = -960 -> 0
      expect(computeLyricScrollOffset(2, lineHeight, 2160)).toBe(0);

      // Tiny viewport (e.g. 50px)
      // activeIndex = 2: 2*48 - 25 + 24 = 95
      expect(computeLyricScrollOffset(2, lineHeight, 50)).toBe(95);

      // Viewport = 0
      // activeIndex = 2: 2*48 - 0 + 24 = 120
      expect(computeLyricScrollOffset(2, lineHeight, 0)).toBe(120);

      // LineHeight = 0
      expect(computeLyricScrollOffset(5, 0, 400)).toBe(0);
    });

    it("verifies behavior when inputs are NaN or unexpected types", () => {
      // Testing current behavior on NaN
      const nanActive = computeLyricScrollOffset(NaN, 48, 400);
      const nanLine = computeLyricScrollOffset(5, NaN, 400);
      const nanView = computeLyricScrollOffset(5, 48, NaN);

      console.log("[EMPIRICAL] computeLyricScrollOffset NaN test:", {
        nanActive,
        nanLine,
        nanView,
      });
      // Document whether NaN is returned or if it should be guarded
    });
  });
});
