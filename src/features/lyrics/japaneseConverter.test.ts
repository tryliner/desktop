import path from "node:path";
import kuromoji from "kuromoji";
import { beforeAll, describe, expect, it } from "vitest";
import { createJapaneseConverter } from "./engine/japaneseConverter";
import type { JapaneseTokenizer } from "./engine/japaneseTypes";

let convert: Awaited<ReturnType<typeof createJapaneseConverter>>;

beforeAll(async () => {
  const tokenizer = await new Promise<JapaneseTokenizer>((resolve, reject) => {
    kuromoji
      .builder({ dicPath: path.resolve("node_modules/kuromoji/dict") })
      .build((error, result) => (error ? reject(error) : resolve(result)));
  });
  convert = await createJapaneseConverter(tokenizer);
}, 20_000);

describe("Japanese dictionary conversion", () => {
  it.each([
    ["夜に駆ける", "yoru ni kakeru"],
    ["愛してる", "aishi teru"],
    ["君", "kimi"],
    ["ありがとう", "arigatō"],
    ["カタカナ", "katakana"],
    ["ｶﾞｯｺｳ", "gakkou"],
    ["私は君を愛してる", "watashi wa kimi o aishi teru"],
    ["東京へ行く", "tōkyō e iku"],
    ["学校へ行こう", "gakkō e ikō"],
    ["今日はいい天気", "kyō wa ii tenki"],
    ["「君が好き」", "「kimi ga suki」"],
    ["君とforever", "kimi to forever"],
    ["Hello 123 世界！", "Hello 123 sekai！"],
    ["Café ありがとう 😍", "Café arigatō 😍"],
    ["君♪…（好き）", "kimi♪…（suki）"],
    ["Hello, world!", "Hello, world!"],
  ])(
    "converts %s while preserving surrounding text",
    async (text, expected) => {
      expect(await convert(text)).toBe(expected);
    },
  );
});
