import { beforeAll, describe, expect, it } from "vitest";
import type { Lyric } from "@braccato/parsers";
import {
  loadRomanizers,
  romanizeLine,
  romanizeLyrics,
} from "./engine/lyricsRomanization";

beforeAll(async () => {
  await loadRomanizers([{ startTimeMs: 0, durationMs: 1000, words: "我爱你" }]);
});

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

  it("leaves japanese lines alone until their dictionary is ready", () => {
    expect(romanizeLine("ありがとう")).toBeNull();
    expect(romanizeLine("カタカナ")).toBeNull();
  });

  it("romanizes chinese as pinyin with tone marks", () => {
    expect(romanizeLine("我爱你")).toBe("wǒ ài nǐ");
    expect(romanizeLine("我愛你")).toBe("wǒ ài nǐ");
    expect(romanizeLine("月亮代表我的心")).toBe("yuè liàng dài biǎo wǒ de xīn");
  });

  it("picks the right reading for polyphonic characters", () => {
    expect(romanizeLine("银行行长")).toBe("yín háng háng zhǎng");
    expect(romanizeLine("重庆很重要")).toBe("chóng qìng hěn zhòng yào");
  });

  it("keeps latin words and tidies spacing around punctuation in chinese", () => {
    expect(romanizeLine("晴天 sunny day")).toBe("qíng tiān sunny day");
    expect(romanizeLine("你说你爱我…")).toBe("nǐ shuō nǐ ài wǒ…");
    expect(romanizeLine("我不想说再见，")).toBe("wǒ bù xiǎng shuō zài jiàn，");
  });

  it("does not leave stray spaces around symbols and brackets in chinese", () => {
    expect(romanizeLine("我爱你~")).toBe("wǒ ài nǐ~");
    expect(romanizeLine("啊——")).toBe("a——");
    expect(romanizeLine("(我爱你)")).toBe("(wǒ ài nǐ)");
    expect(romanizeLine("「我爱你」")).toBe("「wǒ ài nǐ」");
    expect(romanizeLine("我爱你♥")).toBe("wǒ ài nǐ♥");
  });

  it("skips chinese when told the song is japanese", () => {
    expect(romanizeLine("我爱你", "ja")).toBeNull();
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

  it("romanizes a chinese song", () => {
    expect(romanizeLyrics([line("我爱你"), line("La la la")])).toEqual([
      "wǒ ài nǐ",
      null,
    ]);
  });

  it("does not read kanji as pinyin in a japanese song", () => {
    expect(
      romanizeLyrics([line("夜に駆ける"), line("愛してる"), line("君")]),
    ).toEqual([null, null, null]);
  });

  it("handles korean and chinese lines in the same song", () => {
    expect(romanizeLyrics([line("사랑해"), line("我爱你")])).toEqual([
      "saranghae",
      "wǒ ài nǐ",
    ]);
  });
});
