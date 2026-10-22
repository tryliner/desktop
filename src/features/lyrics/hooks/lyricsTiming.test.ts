import { describe, expect, it } from "vitest";
import {
  CROSSFADE_MS,
  PREWARM_MS,
  crossfade,
  easeInOutCubic,
  getActiveLineIndices,
  getPrewarmLeadMs,
  getUnfinishedOutgoingLineIndices,
  wordEmphasis,
} from "./lyricsTiming";

describe("easeInOutCubic", () => {
  it("is anchored at 0, 0.5 and 1 and is non-linear", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });

  it("clamps out-of-range and NaN input", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
    expect(easeInOutCubic(NaN)).toBe(0);
  });
});

describe("crossfade", () => {
  it("overlaps: both sides are partially visible at the boundary", () => {
    const { incoming, outgoing } = crossfade(6000, 6000);
    expect(incoming).toBeCloseTo(0.5);
    expect(outgoing).toBeCloseTo(0.5);
  });

  it("is fully out before the window and fully in after it", () => {
    const half = CROSSFADE_MS / 2;
    expect(crossfade(6000 - half - 1, 6000).incoming).toBe(0);
    expect(crossfade(6000 + half + 1, 6000).incoming).toBe(1);
  });

  it("incoming + outgoing always sum to 1 and incoming never decreases", () => {
    let prev = 0;
    for (let ms = 5900; ms <= 6100; ms += 5) {
      const { incoming, outgoing } = crossfade(ms, 6000);
      expect(incoming + outgoing).toBeCloseTo(1);
      expect(incoming).toBeGreaterThanOrEqual(prev);
      prev = incoming;
    }
  });

  it("falls back to a hard cut when buffer is 0", () => {
    expect(crossfade(5999, 6000, 0).incoming).toBe(0);
    expect(crossfade(6000, 6000, 0).incoming).toBe(1);
  });

  it("never starts its window before 0 (an item at 0ms fades in from 0, not 50%)", () => {
    expect(crossfade(0, 0).incoming).toBe(0);
    expect(crossfade(CROSSFADE_MS, 0).incoming).toBe(1);
  });
});

describe("wordEmphasis", () => {
  const w1 = { timeMs: 1000, endMs: 1900 };
  const w2 = { timeMs: 1900, endMs: 3000 };

  it("consecutive words overlap at their shared boundary", () => {
    expect(wordEmphasis(1900, w1)).toBeCloseTo(0.5);
    expect(wordEmphasis(1900, w2)).toBeCloseTo(0.5);
  });

  it("is fully emphasised mid-word", () => {
    expect(wordEmphasis(1500, w1)).toBe(1);
  });

  it("is 0 well before and well after the word", () => {
    expect(wordEmphasis(500, w1)).toBe(0);
    expect(wordEmphasis(2500, w1)).toBe(0);
  });

  it("zero-duration words pulse for one buffer instead of vanishing", () => {
    const short = { timeMs: 2500, endMs: 2500 };
    expect(wordEmphasis(2000, short)).toBe(0);
    expect(wordEmphasis(2500 + CROSSFADE_MS / 2, short)).toBe(1);
    expect(wordEmphasis(3000, short)).toBe(0);
  });

  it("hard-cuts when buffer is 0", () => {
    expect(wordEmphasis(999, w1, 0)).toBe(0);
    expect(wordEmphasis(1500, w1, 0)).toBe(1);
    expect(wordEmphasis(1900, w1, 0)).toBe(0);
  });
});

describe("getActiveLineIndices", () => {
  const lines = [
    { timeMs: 1000, text: "Main one" },
    { timeMs: 1500, text: "<bg> backing" },
    { timeMs: 1800, text: "  <bg2> more backing" },
    { timeMs: 3000, text: "Main two" },
    { timeMs: 4000, text: "<bg> late backing" },
  ];

  // The loops that lived inline in useLyricsAnimator before they were extracted.
  function legacy(ms: number): number[] {
    const tag = /^\s*<[^>]+>/;
    let main = -1;
    for (let i = 0; i < lines.length; i++) {
      if (ms >= lines[i].timeMs) {
        if (!lines[i].text.match(tag)) main = i;
      } else {
        break;
      }
    }
    const out: number[] = [];
    if (main >= 0) {
      out.push(main);
      for (let i = main + 1; i < lines.length; i++) {
        if (lines[i].text.match(tag)) {
          if (ms >= lines[i].timeMs) out.push(i);
        } else {
          break;
        }
      }
    }
    return out;
  }

  it("matches the original inline algorithm at every 50ms step", () => {
    for (let ms = 0; ms <= 6000; ms += 50) {
      expect(getActiveLineIndices(lines, ms)).toEqual(legacy(ms));
    }
  });

  it("returns nothing before the first main line and for empty input", () => {
    expect(getActiveLineIndices(lines, 999)).toEqual([]);
    expect(getActiveLineIndices([], 5000)).toEqual([]);
  });

  it("a tag-prefixed line before any main line never becomes active", () => {
    const intro = [
      { timeMs: 0, text: "<bg> intro" },
      { timeMs: 1000, text: "Main" },
    ];
    expect(getActiveLineIndices(intro, 500)).toEqual([]);
  });

  it("tag-prefixed lines join the main line once reached", () => {
    expect(getActiveLineIndices(lines, 1200)).toEqual([0]);
    expect(getActiveLineIndices(lines, 1600)).toEqual([0, 1]);
    expect(getActiveLineIndices(lines, 2000)).toEqual([0, 1, 2]);
  });

  it("the next main line replaces the previous group", () => {
    expect(getActiveLineIndices(lines, 3000)).toEqual([3]);
    expect(getActiveLineIndices(lines, 4100)).toEqual([3, 4]);
  });

  it("looking PREWARM_MS ahead activates the next line that much earlier", () => {
    const at = 3000 - PREWARM_MS;
    expect(getActiveLineIndices(lines, at)).toEqual([0, 1, 2]);
    expect(getActiveLineIndices(lines, at + PREWARM_MS)).toEqual([3]);
  });

  it("pre-warm window is wide enough to contain the crossfade start", () => {
    expect(PREWARM_MS).toBeGreaterThanOrEqual(CROSSFADE_MS / 2);
  });

  it("shortens pre-warm to stop at the next line boundary", () => {
    const closeLines = [
      { timeMs: 1000, text: "First" },
      { timeMs: 1080, text: "Second" },
      { timeMs: 1120, text: "Third" },
    ];

    const firstLead = getPrewarmLeadMs(closeLines, 900);
    expect(firstLead).toBe(100);
    expect(getActiveLineIndices(closeLines, 900 + firstLead)).toEqual([0]);

    const secondLead = getPrewarmLeadMs(closeLines, 1000);
    expect(secondLead).toBe(80);
    expect(getActiveLineIndices(closeLines, 1000 + secondLead)).toEqual([1]);

    const thirdLead = getPrewarmLeadMs(closeLines, 1080);
    expect(thirdLead).toBe(40);
    expect(getActiveLineIndices(closeLines, 1080 + thirdLead)).toEqual([2]);
  });

  it("keeps an outgoing line active through its final timed word", () => {
    const lastWordEnds = new Map([[0, 2100]]);

    const lines = [
      { timeMs: 1000, text: "Earlier line" },
      { timeMs: 2000, text: "Next line" },
    ];
    expect(
      getUnfinishedOutgoingLineIndices([0], [1], lastWordEnds, 2099, lines),
    ).toEqual([0]);
    expect(
      getUnfinishedOutgoingLineIndices([0], [1], lastWordEnds, 2100, lines),
    ).toEqual([]);
  });

  it("drops a stale outgoing line that has not started after seeking back", () => {
    const lines = [
      { timeMs: 0, text: "Current line" },
      { timeMs: 3000, text: "Later line" },
      { timeMs: 6000, text: "Stale future line" },
    ];
    const lastWordEnds = new Map([
      [0, 2500],
      [2, 9000],
    ]);

    expect(
      getUnfinishedOutgoingLineIndices([0, 2], [0], lastWordEnds, 1000, lines),
    ).toEqual([]);
  });
});
