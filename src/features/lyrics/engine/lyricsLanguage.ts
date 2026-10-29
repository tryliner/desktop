import { detectNonLatinLanguage } from "@braccato/core/text";
import type { Lyric } from "@braccato/parsers";
import type { LanguageLyric, RomanizationMode } from "./romanizationPreference";

export type HanLanguage = "ja" | "zh" | "yue" | "off";

const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const HAN = /\p{Script=Han}/gu;
const CANTONESE = /[嘅咗唔哋冇喺啲嘢佢咁嚟咩嗰睇]/g;

function count(lyrics: readonly Lyric[], pattern: RegExp): number {
  return lyrics.reduce(
    (total, line) => total + (line.words.match(pattern)?.length ?? 0),
    0,
  );
}

function declaredLanguage(tag: string | undefined): HanLanguage | null {
  const parts =
    typeof tag === "string" ? tag.trim().toLowerCase().split("-") : [];
  if (parts[0] === "ja" || parts[0] === "jpn") return "ja";
  if (parts[0] === "yue" || (parts[0] === "zh" && parts[1] === "yue"))
    return "yue";
  if (parts[0] === "zh" || parts[0] === "cmn") return "zh";
  if (parts[0] === "ko" || parts[0] === "kor") return "off";
  return null;
}

export function getHanLanguage(
  lyrics: readonly Lyric[],
  mode: RomanizationMode = "auto",
): HanLanguage {
  if (mode !== "auto") return mode;
  const declared = new Set(
    (lyrics as readonly LanguageLyric[])
      .map((line) => declaredLanguage(line.language))
      .filter((language) => language !== null),
  );
  if (declared.size === 1) return declared.values().next().value!;
  const kana = count(lyrics, KANA);
  const han = count(lyrics, HAN);
  if (kana > 0 && kana / (kana + han) >= 0.1) return "ja";
  return count(lyrics, CANTONESE) >= 2 ? "yue" : "zh";
}

export function getLineLanguage(text: string, hanLanguage: HanLanguage) {
  const language = detectNonLatinLanguage(text);
  if (language === "ja" || language === "ko") return language;
  if (language === "zh")
    return hanLanguage === "yue" || hanLanguage === "off" ? null : hanLanguage;
  return null;
}
