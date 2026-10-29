import { romanize as romanizeHangul } from "@romanize/korean";
import type { Lyric } from "@braccato/parsers";
import {
  getHanLanguage,
  getLineLanguage,
  type HanLanguage,
} from "./lyricsLanguage";
import {
  isInstrumental,
  providedRomanization,
  type RomanizationMode,
} from "./romanizationPreference";

type Pinyin = typeof import("pinyin-pro").pinyin;
type ToSimplified = typeof import("chinese-conv").sify;

const HANGUL_RUN = /[ᄀ-ᇿ㄰-㆏가-힯]+/g;
const HAN_RUN = /[㐀-䶿一-鿿豈-﫿]+/g;
const SPACE_BEFORE_CLOSING =
  /\s+([，。！？、；：,.!?;:…~～—）)」』】\]》”’♥♪])/g;
const SPACE_AFTER_OPENING = /([（(「『【[《“‘])\s+/g;

let pinyin: Pinyin | null = null;
let toSimplified: ToSimplified | null = null;
let japanese: typeof import("./japaneseRomanization") | null = null;

function romanizeKorean(text: string): string {
  return text.replace(HANGUL_RUN, (run) => romanizeHangul(run));
}

function romanizeChinese(text: string): string | null {
  const convert = toSimplified;
  if (!pinyin || !convert) return null;
  const simplified = text.replace(HAN_RUN, (run) => convert(run));
  return pinyin(simplified, { nonZh: "consecutive" })
    .replace(/\s{2,}/g, " ")
    .replace(SPACE_BEFORE_CLOSING, "$1")
    .replace(SPACE_AFTER_OPENING, "$1");
}

export async function loadRomanizers(
  lyrics: readonly Lyric[],
  mode: RomanizationMode = "auto",
): Promise<void> {
  if (mode === "off") return;
  const hanLanguage = getHanLanguage(lyrics, mode);
  const languages = lyrics.map((line) =>
    isInstrumental(line) || providedRomanization(line)
      ? null
      : getLineLanguage(line.words, hanLanguage),
  );
  const loadChinese = async () => {
    if (pinyin && toSimplified) return;
    const [pinyinModule, convModule] = await Promise.all([
      import("pinyin-pro"),
      import("chinese-conv"),
    ]);
    pinyin = pinyinModule.pinyin;
    toSimplified = convModule.sify;
  };
  const loadJapanese = async () => {
    japanese ??= await import("./japaneseRomanization");
    await japanese.prepareJapaneseLyrics(
      lyrics.filter((_, i) => languages[i] === "ja").map((line) => line.words),
    );
  };
  const results = await Promise.allSettled([
    languages.includes("zh") ? loadChinese() : undefined,
    languages.includes("ja") ? loadJapanese() : undefined,
  ]);
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }
}

export function romanizeLine(
  text: string,
  hanLanguage: HanLanguage = "zh",
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const language = getLineLanguage(trimmed, hanLanguage);
  try {
    let romanized: string | null;
    if (language === "ko") romanized = romanizeKorean(trimmed);
    else if (language === "zh") romanized = romanizeChinese(trimmed);
    else if (language === "ja")
      romanized = japanese?.readJapaneseRomanization(trimmed) ?? null;
    else return null;
    romanized = romanized?.trim() ?? "";
    return romanized && romanized !== trimmed ? romanized : null;
  } catch {
    return null;
  }
}

export function hasRomanizableLyrics(
  lyrics: readonly Lyric[],
  mode: RomanizationMode = "auto",
): boolean {
  if (mode === "off") return false;
  const hanLanguage = getHanLanguage(lyrics, mode);
  return lyrics.some(
    (line) =>
      !isInstrumental(line) &&
      (providedRomanization(line) !== null ||
        getLineLanguage(line.words, hanLanguage) !== null),
  );
}

export function romanizeLyrics(
  lyrics: readonly Lyric[],
  mode: RomanizationMode = "auto",
): (string | null)[] {
  const hanLanguage = getHanLanguage(lyrics, mode);
  return lyrics.map((line) =>
    mode === "off" || isInstrumental(line)
      ? null
      : (providedRomanization(line) ?? romanizeLine(line.words, hanLanguage)),
  );
}
