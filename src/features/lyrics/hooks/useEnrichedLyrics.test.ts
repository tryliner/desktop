import { describe, it, expect } from "vitest";
import { enrichLyrics } from "./useEnrichedLyrics";
import type { Lyric } from "@braccato/parsers";

describe("enrichLyrics", () => {
  const dummyLyrics: Lyric[] = [
    {
      words: "Hello world",
      startTimeMs: 1000,
      durationMs: 2000,
      isInstrumental: false,
    },
    {
      words: "Peace to all",
      startTimeMs: 3000,
      durationMs: 2000,
      isInstrumental: false,
    },
  ];

  it("returns base lyrics untouched when translations are omitted", () => {
    const result = enrichLyrics(dummyLyrics);
    expect(result).toEqual(dummyLyrics);
  });

  it("attaches translated text when provided", () => {
    const result = enrichLyrics(
      dummyLyrics,
      ["Xin chào thế giới", "Bình yên cho muôn loài"],
      undefined,
      "vi",
    );
    expect(result[0].translation?.text).toBe("Xin chào thế giới");
    expect(result[0].translation?.lang).toBe("vi");
    expect(result[1].translation?.text).toBe("Bình yên cho muôn loài");
  });

  it("attaches romanization text when provided", () => {
    const result = enrichLyrics(
      dummyLyrics,
      undefined,
      ["Zankoku na tenshi", "Aoi sora"],
    );
    expect(result[0].romanization).toBe("Zankoku na tenshi");
    expect(result[1].romanization).toBe("Aoi sora");
  });
});
