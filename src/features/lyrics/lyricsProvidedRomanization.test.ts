import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lyric } from "@braccato/parsers";
import { parseRawLyrics } from "./engine/lyricsParser";

const japanese = vi.hoisted(() => ({
  prepareJapaneseLyrics: vi.fn(async () => {}),
  readJapaneseRomanization: vi.fn(() => "generated reading"),
}));
vi.mock("./engine/japaneseRomanization", () => japanese);
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("provider readings", () => {
  it("uses provider readings instead of starting the Japanese dictionary", async () => {
    const mod = await import("./engine/lyricsRomanization");
    const song: Lyric[] = [
      { words: "宇宙", romanization: "sora", startTimeMs: 0, durationMs: 1000 },
    ];
    await mod.loadRomanizers(song, "ja");
    expect(mod.romanizeLyrics(song, "ja")).toEqual(["sora"]);
    expect(japanese.prepareJapaneseLyrics).not.toHaveBeenCalled();
  });

  it("falls back to generation only for lines missing a provider reading", async () => {
    const mod = await import("./engine/lyricsRomanization");
    const song: Lyric[] = [
      { words: "君", romanization: "kimi", startTimeMs: 0, durationMs: 1000 },
      { words: "ありがとう", startTimeMs: 1000, durationMs: 1000 },
    ];
    await mod.loadRomanizers(song);
    expect(japanese.prepareJapaneseLyrics).toHaveBeenCalledWith(["ありがとう"]);
    expect(mod.romanizeLyrics(song)).toEqual(["kimi", "generated reading"]);
  });

  it("preserves embedded TTML transliterations", async () => {
    const raw = `<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="ja"><head><metadata><transliterations><transliteration><text for="L1">sora</text></transliteration></transliterations></metadata></head><body dur="1s"><div><p key="L1" begin="0s" end="1s">宇宙</p></div></body></tt>`;
    const song = parseRawLyrics(raw, "ttml").braccatoLyrics;
    const mod = await import("./engine/lyricsRomanization");
    expect(song[0].romanization).toBe("sora");
    await mod.loadRomanizers(song);
    expect(mod.romanizeLyrics(song)).toEqual(["sora"]);
    expect(japanese.prepareJapaneseLyrics).not.toHaveBeenCalled();
  });

  it("hides provider readings for Skip and supports readings in other scripts", async () => {
    const mod = await import("./engine/lyricsRomanization");
    const song: Lyric[] = [
      {
        words: "Привет",
        romanization: "privet",
        startTimeMs: 0,
        durationMs: 1000,
      },
    ];
    expect(mod.hasRomanizableLyrics(song)).toBe(true);
    expect(mod.romanizeLyrics(song)).toEqual(["privet"]);
    expect(mod.romanizeLyrics(song, "off")).toEqual([null]);
  });
});
