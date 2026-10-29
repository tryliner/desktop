import Kuroshiro from "kuroshiro";
import type { JapaneseTokenizer } from "./japaneseTypes";

const JAPANESE_RUN =
  /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ーﾞﾟ゙゚]+)/u;
const LETTER_END = /[\p{L}\p{N}]$/u;
const LETTER_START = /^[\p{L}\p{N}]/u;

export async function createJapaneseConverter(tokenizer: JapaneseTokenizer) {
  const converter = new Kuroshiro();
  await converter.init({
    init: async () => {},
    parse: async (text) => tokenizer.tokenize(text),
  });

  return async (text: string): Promise<string> => {
    const pieces = text.split(JAPANESE_RUN);
    const converted = await Promise.all(
      pieces.map((piece, i) =>
        i % 2 === 1
          ? converter.convert(piece.normalize("NFKC"), {
              to: "romaji",
              mode: "spaced",
              romajiSystem: "hepburn",
            })
          : piece,
      ),
    );
    return converted
      .reduce((result, piece) => {
        const space = LETTER_END.test(result) && LETTER_START.test(piece);
        return result + (space ? " " : "") + piece;
      }, "")
      .trim();
  };
}
