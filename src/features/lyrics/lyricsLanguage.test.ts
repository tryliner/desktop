import { beforeAll, describe, expect, it } from "vitest";
import type { Lyric } from "@braccato/parsers";
import {
  hasRomanizableLyrics,
  loadRomanizers,
  romanizeLine,
  romanizeLyrics,
} from "./engine/lyricsRomanization";

beforeAll(async () => {
  await loadRomanizers([{ startTimeMs: 0, durationMs: 1000, words: "我爱你" }]);
});

describe("hasRomanizableLyrics", () => {
  const line = (words: string): Lyric => ({
    startTimeMs: 0,
    durationMs: 1000,
    words,
  });

  it("is true for a chinese song", () => {
    expect(hasRomanizableLyrics([line("Hello"), line("我爱你")])).toBe(true);
  });

  it("is true for a japanese song even when it has kanji-only lines", () => {
    expect(hasRomanizableLyrics([line("夜に駆ける"), line("君")])).toBe(true);
  });

  it("is true when any line has hangul", () => {
    expect(
      hasRomanizableLyrics([line("Cause, ooh"), line("도망가 여길 벗어나")]),
    ).toBe(true);
  });

  it("is false for songs in other scripts", () => {
    expect(hasRomanizableLyrics([line("Bloodshot eyes"), line("Привет")])).toBe(
      false,
    );
    expect(hasRomanizableLyrics([])).toBe(false);
  });
});

describe("song language rules for chinese characters", () => {
  const line = (words: string): Lyric => ({
    startTimeMs: 0,
    durationMs: 1000,
    words,
  });

  it("keeps pinyin when a chinese song has one short japanese line", () => {
    const chinese = Array.from({ length: 8 }, () => line("月亮代表我的心"));
    const result = romanizeLyrics([...chinese, line("ありがとう")]);
    expect(result.slice(0, 8)).toEqual(
      Array(8).fill("yuè liàng dài biǎo wǒ de xīn"),
    );
    expect(result[8]).toBeNull();
    expect(hasRomanizableLyrics([...chinese, line("ありがとう")])).toBe(true);
  });

  it("treats a song as japanese once kana is a large share of its text", () => {
    const song = [line("夜に駆ける"), line("愛してる"), line("君")];
    expect(romanizeLyrics(song)).toEqual([null, null, null]);
    expect(hasRomanizableLyrics(song)).toBe(true);
  });

  it("skips pinyin for songs written in colloquial cantonese", () => {
    const song = [line("你嘅愛"), line("唔好走")];
    expect(romanizeLyrics(song)).toEqual([null, null]);
    expect(hasRomanizableLyrics(song)).toBe(false);
  });

  it("does not take one cantonese character as a sign of cantonese", () => {
    expect(romanizeLyrics([line("我爱你"), line("佢")])[0]).toBe("wǒ ài nǐ");
  });

  it("does not mistake the mandarin word 關係 for cantonese", () => {
    expect(romanizeLine("我們的關係")).toBe("wǒ men de guān xì");
    expect(hasRomanizableLyrics([line("我們的關係"), line("關係")])).toBe(true);
  });
});
