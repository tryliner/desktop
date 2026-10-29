import {
  detectParser,
  parseTTMLContent,
  TTMLParser,
  type Lyric,
} from "@braccato/parsers";
import { tryParseRichsync, tryParseMxmSubtitles } from "./lyricsJson";
import { isInstrumental } from "./romanizationPreference";
import type { ParsedLyrics, SyncedLine } from "./lyricsTypes";

export type { ParsedLyrics, SyncedLine, WordData } from "./lyricsTypes";
export { applyLyricsOffset } from "./lyricsOffset";

export function parseRawLyrics(
  raw: string,
  _format?: string,
  songDurationMs?: number,
): ParsedLyrics {
  const trimmed = raw?.trim();
  const empty = {
    braccatoLyrics: [],
    syncedLines: [],
    plainLyrics: trimmed || null,
  };
  if (!trimmed) return empty;
  try {
    const richsync = tryParseRichsync(trimmed);
    const subtitles = richsync ? null : tryParseMxmSubtitles(trimmed);
    const parser = detectParser(trimmed);
    const ttml =
      !richsync && !subtitles && parser === TTMLParser
        ? parseTTMLContent(trimmed, { songDurationMs })
        : null;
    const parsed =
      richsync ??
      subtitles ??
      ttml?.lyrics ??
      parser.parse(trimmed, songDurationMs);
    const language = ttml?.language;
    const braccatoLyrics: Lyric[] = language
      ? parsed.map((line) => ({ ...line, language }))
      : parsed;
    if (!braccatoLyrics.length) return empty;
    const syncedLines: SyncedLine[] = braccatoLyrics.map((line) => ({
      timeMs: line.startTimeMs,
      durationMs: line.durationMs,
      text: line.words,
      isInstrumental: isInstrumental(line),
      words: line.parts?.map((part) => ({
        timeMs: part.startTimeMs,
        endMs: part.startTimeMs + part.durationMs,
        text: part.words,
        isBackground: part.isBackground,
      })),
    }));
    return {
      braccatoLyrics,
      syncedLines,
      plainLyrics:
        braccatoLyrics
          .map((line) => line.words)
          .join("\n")
          .trim() || null,
      ...(language ? { language } : {}),
    };
  } catch {
    return empty;
  }
}
