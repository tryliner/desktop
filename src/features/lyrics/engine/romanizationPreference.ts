import type { Lyric } from "@braccato/parsers";

export type RomanizationMode = "auto" | "ja" | "zh" | "off";
export type LanguageLyric = Lyric & { language?: string };

export function romanizationKey(
  trackId: string | null,
  lyrics: readonly Lyric[],
): string {
  let hash = 0xcbf29ce484222325n;
  for (const line of lyrics as readonly LanguageLyric[]) {
    const text = JSON.stringify([line.words, line.language ?? null]);
    for (let i = 0; i < text.length; i++) {
      hash = BigInt.asUintN(
        64,
        (hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n,
      );
    }
  }
  return `${trackId ?? "untracked"}:${hash.toString(16)}`;
}

export function providedRomanization(line: Lyric): string | null {
  return (
    line.romanization?.trim() ||
    line.timedRomanization
      ?.map((part) => part.words)
      .join("")
      .trim() ||
    null
  );
}

export function isInstrumental(line: Lyric): boolean {
  return Boolean((line as Lyric & { isInstrumental?: boolean }).isInstrumental);
}
