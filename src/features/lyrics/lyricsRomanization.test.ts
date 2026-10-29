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

  it("leaves japanese lines alone", () => {
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
    expect(romanizeLine("我爱你", false)).toBeNull();
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

describe("hasRomanizableLyrics", () => {
  const line = (words: string): Lyric => ({
    startTimeMs: 0,
    durationMs: 1000,
    words,
  });

  it("is true for a chinese song", () => {
    expect(hasRomanizableLyrics([line("Hello"), line("我爱你")])).toBe(true);
  });

  it("is false for a japanese song even when it has kanji-only lines", () => {
    expect(hasRomanizableLyrics([line("夜に駆ける"), line("君")])).toBe(false);
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
    expect(hasRomanizableLyrics(song)).toBe(false);
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

describe("traditional chinese characters", () => {
  it("reads common neutral-tone words the same as simplified", () => {
    expect(romanizeLine("什麼")).toBe(romanizeLine("什么"));
    expect(romanizeLine("什麼")).toBe("shén me");
    expect(romanizeLine("你愛我嗎")).toBe("nǐ ài wǒ ma");
    expect(romanizeLine("我們")).toBe("wǒ men");
  });

  it("picks the right reading for common traditional words", () => {
    expect(romanizeLine("時間")).toBe("shí jiān");
    expect(romanizeLine("長大")).toBe("zhǎng dà");
    expect(romanizeLine("音樂")).toBe("yīn yuè");
    expect(romanizeLine("因為你")).toBe("yīn wèi nǐ");
    expect(romanizeLine("還是你")).toBe("hái shì nǐ");
    expect(romanizeLine("為你")).toBe("wèi nǐ");
  });

  it("handles traditional polyphonic place and bank names", () => {
    expect(romanizeLine("重慶很重要")).toBe("chóng qìng hěn zhòng yào");
    expect(romanizeLine("銀行行長")).toBe("yín háng háng zhǎng");
  });

  it("keeps latin words in a traditional line", () => {
    expect(romanizeLine("因為你讓我看見forever")).toBe(
      "yīn wèi nǐ ràng wǒ kàn jiàn forever",
    );
  });
});
