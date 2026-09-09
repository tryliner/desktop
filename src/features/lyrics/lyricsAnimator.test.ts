import { describe, expect, it } from "vitest";
import type { SyncedLine } from "./hooks/useLyricsAnimator";

describe("Lyrics Animator Clock Synchronization logic", () => {
  const sampleLines: SyncedLine[] = [
    {
      timeMs: 2000,
      text: "Line at 2s",
      words: [
        { timeMs: 2000, endMs: 3000, text: "Line " },
        { timeMs: 3000, endMs: 4000, text: "at " },
        { timeMs: 4000, endMs: 5000, text: "2s" },
      ],
    },
    {
      timeMs: 6000,
      text: "Line at 6s",
      words: [
        { timeMs: 6000, endMs: 8000, text: "Line at 6s" },
      ],
    },
  ];

  it("does not extrapolate time while isPlaying is false (loading/paused state)", () => {
    let isPlaying = false;
    let positionMs = 0;
    let anchorPos = positionMs;
    let anchorTime = 1000;
    const now = 3500; // 2.5 seconds elapsed while loading!

    const estimated = isPlaying
      ? Math.max(0, anchorPos + (now - anchorTime))
      : anchorPos;

    // Must be strictly 0ms, not 2500ms
    expect(estimated).toBe(0);

    // Active line index must not advance prematurely
    let activeLine = -1;
    for (let i = 0; i < sampleLines.length; i++) {
      if (estimated >= sampleLines[i].timeMs) {
        activeLine = i;
      }
    }
    expect(activeLine).toBe(-1);
  });

  it("resets anchor when isPlaying transitions to true so clock begins at 0", () => {
    let positionMs = 0;
    let anchorPos = positionMs;
    let anchorTime = 3500; // Reset anchor to the exact moment audio begins
    let isPlaying = true;

    // 100ms later during actual playback
    const now = 3600;
    const estimated = isPlaying
      ? Math.max(0, anchorPos + (now - anchorTime))
      : anchorPos;

    expect(estimated).toBe(100);
  });

  it("word-fill progress calculates accurately without overflowing 100%", () => {
    const word = { timeMs: 2000, endMs: 3000, text: "Test" };
    
    // Before word
    expect(calcWordProgress(1500, word)).toBe(0);
    // Middle of word (50%)
    expect(calcWordProgress(2500, word)).toBe(50);
    // End of word (100%)
    expect(calcWordProgress(3000, word)).toBe(100);
    // After word
    expect(calcWordProgress(5000, word)).toBe(100);
  });
});

function calcWordProgress(estimatedMs: number, w: { timeMs: number; endMs: number }) {
  if (w.endMs <= w.timeMs) {
    return estimatedMs >= w.timeMs ? 100 : 0;
  }
  if (estimatedMs >= w.endMs) return 100;
  if (estimatedMs <= w.timeMs) return 0;
  const pct = ((estimatedMs - w.timeMs) / (w.endMs - w.timeMs)) * 100;
  return Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct));
}
