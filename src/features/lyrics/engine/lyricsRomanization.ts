import { romanize as romanizeHangul } from "@romanize/korean";
import { detectNonLatinLanguage } from "@braccato/core/text";
import type { Lyric } from "@braccato/parsers";

type Pinyin = typeof import("pinyin-pro").pinyin;
type ToSimplified = typeof import("chinese-conv").sify;

const HANGUL_RUN = /[ᄀ-ᇿ㄰-㆏가-힯]+/g;
const KANA = /[぀-ヿㇰ-ㇿ]/g;
const HAN = /[㐀-䶿一-鿿豈-﫿]/g;
const HAN_RUN = /[㐀-䶿一-鿿豈-﫿]+/g;
const CANTONESE = /[嘅咗唔哋冇喺啲嘢佢咁嚟咩嗰睇]/g;
const SPACE_BEFORE_CLOSING =
  /\s+([，。！？、；：,.!?;:…~～—）)」』】\]》”’♥♪])/g;
const SPACE_AFTER_OPENING = /([（(「『【[《“‘])\s+/g;

const JAPANESE_KANA_SHARE = 0.1;
const CANTONESE_MARKS_NEEDED = 2;

let pinyin: Pinyin | null = null;
let toSimplified: ToSimplified | null = null;

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

function countMatches(lyrics: readonly Lyric[], pattern: RegExp): number {
  let total = 0;
  for (const line of lyrics) total += line.words.match(pattern)?.length ?? 0;
  return total;
}

function allowsChinese(lyrics: readonly Lyric[]): boolean {
  const kana = countMatches(lyrics, KANA);
  const han = countMatches(lyrics, HAN);
  if (kana > 0 && kana / (kana + han) >= JAPANESE_KANA_SHARE) return false;
  return countMatches(lyrics, CANTONESE) < CANTONESE_MARKS_NEEDED;
}

function isChineseLine(text: string, allowChinese: boolean): boolean {
  return allowChinese && detectNonLatinLanguage(text) === "zh";
}

export async function loadRomanizers(lyrics: readonly Lyric[]): Promise<void> {
  if (pinyin && toSimplified) return;
  const allowChinese = allowsChinese(lyrics);
  if (!lyrics.some((line) => isChineseLine(line.words, allowChinese))) return;
  const [pinyinModule, convModule] = await Promise.all([
    import("pinyin-pro"),
    import("chinese-conv"),
  ]);
  pinyin = pinyinModule.pinyin;
  toSimplified = convModule.sify;
}

export function romanizeLine(
  text: string,
  allowChinese: boolean = true,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const language = detectNonLatinLanguage(trimmed);
  try {
    let romanized: string | null;
    if (language === "ko") romanized = romanizeKorean(trimmed);
    else if (language === "zh" && allowChinese)
      romanized = romanizeChinese(trimmed);
    else return null;
    romanized = romanized?.trim() ?? "";
    return romanized && romanized !== trimmed ? romanized : null;
  } catch {
    return null;
  }
}

export function hasRomanizableLyrics(lyrics: readonly Lyric[]): boolean {
  const allowChinese = allowsChinese(lyrics);
  return lyrics.some(
    (line) =>
      detectNonLatinLanguage(line.words) === "ko" ||
      isChineseLine(line.words, allowChinese),
  );
}

export function romanizeLyrics(lyrics: readonly Lyric[]): (string | null)[] {
  const allowChinese = allowsChinese(lyrics);
  return lyrics.map((line) =>
    (line as { isInstrumental?: boolean }).isInstrumental
      ? null
      : romanizeLine(line.words, allowChinese),
  );
}
