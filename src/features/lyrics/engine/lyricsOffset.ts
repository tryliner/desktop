import type { Lyric } from "@braccato/parsers";
import type { SyncedLine } from "./lyricsTypes";

export function applyLyricsOffset(
  parsed: { braccatoLyrics: Lyric[]; syncedLines: SyncedLine[] },
  offsetMs: number,
): { braccatoLyrics: Lyric[]; syncedLines: SyncedLine[] } {
  if (!offsetMs) return parsed;
  const braccatoLyrics = parsed.braccatoLyrics.map((line) => ({
    ...line,
    startTimeMs: Math.max(0, line.startTimeMs + offsetMs),
    ...(line.parts
      ? {
          parts: line.parts.map((part) => ({
            ...part,
            startTimeMs: Math.max(0, part.startTimeMs + offsetMs),
          })),
        }
      : {}),
    ...(line.timedRomanization
      ? {
          timedRomanization: line.timedRomanization.map((part) => ({
            ...part,
            startTimeMs: Math.max(0, part.startTimeMs + offsetMs),
          })),
        }
      : {}),
  }));
  const syncedLines = parsed.syncedLines.map((line) => ({
    ...line,
    timeMs: Math.max(0, line.timeMs + offsetMs),
    ...(line.words
      ? {
          words: line.words.map((word) => ({
            ...word,
            timeMs: Math.max(0, word.timeMs + offsetMs),
            endMs: Math.max(0, word.endMs + offsetMs),
          })),
        }
      : {}),
  }));
  return { braccatoLyrics, syncedLines };
}
