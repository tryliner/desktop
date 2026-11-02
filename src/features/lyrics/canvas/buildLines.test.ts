import { describe, it, expect } from "vitest";
import { buildLines } from "./buildLines";
import type { Lyric } from "@braccato/parsers";

describe("buildLines", () => {
  it("renders both romanization and translation separated by bullet when both exist", () => {
    const lyrics: Lyric[] = [
      {
        words: "残酷な天使のテーゼ",
        startTimeMs: 1000,
        durationMs: 2000,
        isInstrumental: false,
        romanization: "Zankoku na tenshi no teeze",
        translation: { text: "A Cruel Angel's Thesis", lang: "en" },
      },
    ];

    const model = buildLines(lyrics);
    expect(model.lines[0].subtitle).toBe(
      "Zankoku na tenshi no teeze • A Cruel Angel's Thesis",
    );
  });

  it("renders only translation when romanization is absent", () => {
    const lyrics: Lyric[] = [
      {
        words: "Hello",
        startTimeMs: 1000,
        durationMs: 2000,
        isInstrumental: false,
        translation: { text: "Xin chào", lang: "vi" },
      },
    ];

    const model = buildLines(lyrics);
    expect(model.lines[0].subtitle).toBe("Xin chào");
  });

  it("renders only romanization when translation is absent", () => {
    const lyrics: Lyric[] = [
      {
        words: "안녕",
        startTimeMs: 1000,
        durationMs: 2000,
        isInstrumental: false,
        romanization: "annyeong",
      },
    ];

    const model = buildLines(lyrics);
    expect(model.lines[0].subtitle).toBe("annyeong");
  });

  it("falls back to romanization when translation is whitespace-only", () => {
    const lyrics: Lyric[] = [
      {
        words: "안녕",
        startTimeMs: 1000,
        durationMs: 2000,
        isInstrumental: false,
        translation: { text: "   ", lang: "en" },
        romanization: "annyeong",
      },
    ];

    const model = buildLines(lyrics);
    expect(model.lines[0].subtitle).toBe("annyeong");
  });
});
