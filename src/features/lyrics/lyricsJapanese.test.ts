import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lyric } from "@braccato/parsers";

const japanese = vi.hoisted(() => {
  const cache = new Map<string, string>();
  const readings: Record<string, string> = {
    夜に駆ける: "yoru ni kakeru",
    君: "kimi",
    ありがとう: "arigatō",
  };
  return {
    cache,
    prepareJapaneseLyrics: vi.fn(async (texts: string[]) => {
      texts.forEach((text) => cache.set(text, readings[text]));
    }),
    readJapaneseRomanization: (text: string) => cache.get(text) ?? null,
  };
});

vi.mock("./engine/japaneseRomanization", () => japanese);

const line = (words: string): Lyric => ({
  startTimeMs: 0,
  durationMs: 1000,
  words,
});

beforeEach(() => {
  vi.resetModules();
  japanese.cache.clear();
  japanese.prepareJapaneseLyrics.mockClear();
});

describe("Japanese lyric routing", () => {
  it("reads kanji-only lines using the song's Japanese context", async () => {
    const mod = await import("./engine/lyricsRomanization");
    const song = [line("夜に駆ける"), line("君"), line("Hello")];
    expect(mod.hasRomanizableLyrics(song)).toBe(true);
    await mod.loadRomanizers(song);
    expect(mod.romanizeLyrics(song)).toEqual(["yoru ni kakeru", "kimi", null]);
    expect(mod.romanizeLine("我爱你")).toBeNull();
  });

  it("loads Japanese after Chinese was already loaded", async () => {
    const mod = await import("./engine/lyricsRomanization");
    await mod.loadRomanizers([line("我爱你")]);
    await mod.loadRomanizers([line("ありがとう")]);
    expect(mod.romanizeLine("ありがとう")).toBe("arigatō");
    expect(mod.romanizeLine("我爱你")).toBe("wǒ ài nǐ");
  });

  it("reads a short Japanese passage without disabling Mandarin", async () => {
    const mod = await import("./engine/lyricsRomanization");
    const chinese = Array.from({ length: 8 }, () => line("月亮代表我的心"));
    const song = [...chinese, line("ありがとう"), line("사랑해")];
    await mod.loadRomanizers(song);
    expect(mod.romanizeLyrics(song)).toEqual([
      ...Array(8).fill("yuè liàng dài biǎo wǒ de xīn"),
      "arigatō",
      "saranghae",
    ]);
  });

  it("keeps Cantonese excluded while supporting Japanese passages", async () => {
    const mod = await import("./engine/lyricsRomanization");
    const song = [line("你嘅愛唔好走".repeat(10)), line("ありがとう")];
    await mod.loadRomanizers(song);
    expect(mod.romanizeLyrics(song)).toEqual([null, "arigatō"]);
  });

  it("does not prepare instrumental lines", async () => {
    const mod = await import("./engine/lyricsRomanization");
    const song = [{ ...line("ありがとう"), isInstrumental: true }];
    await mod.loadRomanizers(song);
    expect(mod.romanizeLyrics(song)).toEqual([null]);
    expect(japanese.prepareJapaneseLyrics).not.toHaveBeenCalled();
  });

  it("keeps Mandarin ready when the Japanese worker fails", async () => {
    const mod = await import("./engine/lyricsRomanization");
    japanese.prepareJapaneseLyrics.mockRejectedValueOnce(
      new Error("worker failed"),
    );
    const chinese = Array.from({ length: 8 }, () => line("月亮代表我的心"));
    const song = [...chinese, line("ありがとう")];
    await expect(mod.loadRomanizers(song)).rejects.toThrow("worker failed");
    expect(mod.romanizeLyrics(song)).toEqual([
      ...Array(8).fill("yuè liàng dài biǎo wǒ de xīn"),
      null,
    ]);
  });
});
