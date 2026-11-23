import { describe, expect, it } from "vitest";
import { applyLyricsOffset } from "./engine/lyricsParser";
import type { Lyric } from "@braccato/parsers";

describe("applyLyricsOffset", () => {
  const braccatoLyrics: Lyric[] = [
    {
      startTimeMs: 1000,
      durationMs: 2000,
      words: "Hello world",
      parts: [
        { startTimeMs: 1000, durationMs: 900, words: "Hello " },
        { startTimeMs: 1900, durationMs: 1100, words: "world" },
      ],
    },
    { startTimeMs: 3500, durationMs: 1500, words: "Second line" },
  ];
  const syncedLines = [
    {
      timeMs: 1000,
      text: "Hello world",
      words: [
        { timeMs: 1000, endMs: 1900, text: "Hello " },
        { timeMs: 1900, endMs: 3000, text: "world" },
      ],
    },
    { timeMs: 3500, text: "Second line" },
  ];

  it("returns original when offset is 0", () => {
    const result = applyLyricsOffset({ braccatoLyrics, syncedLines }, 0);
    expect(result.braccatoLyrics[0].startTimeMs).toBe(1000);
  });

  it("applies positive offset", () => {
    const result = applyLyricsOffset({ braccatoLyrics, syncedLines }, 500);
    expect(result.braccatoLyrics[0].startTimeMs).toBe(1500);
    expect(result.braccatoLyrics[1].startTimeMs).toBe(4000);
    expect(result.syncedLines[0].timeMs).toBe(1500);
  });

  it("applies negative offset", () => {
    const result = applyLyricsOffset({ braccatoLyrics, syncedLines }, -300);
    expect(result.braccatoLyrics[0].startTimeMs).toBe(700);
    expect(result.braccatoLyrics[1].startTimeMs).toBe(3200);
  });

  it("clamps negative offset to zero", () => {
    const result = applyLyricsOffset({ braccatoLyrics, syncedLines }, -2000);
    expect(result.braccatoLyrics[0].startTimeMs).toBe(0);
    expect(result.syncedLines[0].timeMs).toBe(0);
  });
});
