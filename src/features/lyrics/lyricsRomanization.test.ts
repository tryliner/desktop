import { describe, expect, it } from "vitest";
import type { Lyric } from "@braccato/parsers";
import {
  hasRomanizableLyrics,
  romanizeLine,
  romanizeLyrics,
} from "./engine/lyricsRomanization";

describe("romanizeLine", () => {
  it("romanizes hangul following pronunciation rules", () => {
    expect(romanizeLine("너 뭔데 자꾸 생각나")).toBe(
      "neo mwonde jakku saenggangna",
    );
    expect(romanizeLine("잡힐 듯 잡히지 않아")).toBe("japil deut japiji anha");
  });

  it("keeps latin words and digits inside a korean line", () => {
    expect(romanizeLine("Hello 123 마지막처럼")).toBe(
      "Hello 123 majimakcheoreom",
    );
  });

  it("keeps punctuation, symbols and emoji that the romanizer cannot take", () => {
    expect(romanizeLine("사랑해…")).toBe("saranghae…");
    expect(romanizeLine("난 ’그냥’ 좋아")).toBe("nan ’geunyang’ joha");
    expect(romanizeLine("사랑♪ 😍")).toBe("sarang♪ 😍");
    expect(romanizeLine("사랑해 — 정말")).toBe("saranghae — jeongmal");
    expect(romanizeLine("韓國 사랑")).toBe("韓國 sarang");
    expect(romanizeLine("Café 사랑")).toBe("Café sarang");
  });

  it("skips lines with nothing to romanize", () => {
    expect(romanizeLine("Bloodshot eyes tonight")).toBeNull();
    expect(romanizeLine("   ")).toBeNull();
    expect(romanizeLine("")).toBeNull();
    expect(romanizeLine("♪")).toBeNull();
  });

  it("leaves japanese and chinese lines alone", () => {
    expect(romanizeLine("ありがとう")).toBeNull();
    expect(romanizeLine("我爱你")).toBeNull();
  });
});

describe("romanizeLyrics", () => {
  const line = (words: string, extra: Partial<Lyric> = {}): Lyric => ({
    startTimeMs: 0,
    durationMs: 1000,
    words,
    ...extra,
  });

  it("returns one entry per line so it lines up with the rendered lines", () => {
    const result = romanizeLyrics([
      line("마지막처럼"),
      line("Cause, ooh"),
      line("도망가 여길 벗어나"),
    ]);
    expect(result).toEqual([
      "majimakcheoreom",
      null,
      "domangga yeogil beoseona",
    ]);
  });

  it("skips instrumental lines", () => {
    const instrumental = { ...line("마지막"), isInstrumental: true } as Lyric;
    expect(romanizeLyrics([instrumental])).toEqual([null]);
  });
});

describe("hasRomanizableLyrics", () => {
  const line = (words: string): Lyric => ({
    startTimeMs: 0,
    durationMs: 1000,
    words,
  });

  it("is true when any line has hangul", () => {
    expect(
      hasRomanizableLyrics([line("Cause, ooh"), line("도망가 여길 벗어나")]),
    ).toBe(true);
  });

  it("is false for songs in other scripts", () => {
    expect(
      hasRomanizableLyrics([line("Bloodshot eyes"), line("ありがとう")]),
    ).toBe(false);
    expect(hasRomanizableLyrics([])).toBe(false);
  });
});
