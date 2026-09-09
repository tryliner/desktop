import { detectParser, type Lyric, type LyricPart } from "@braccato/parsers";

export interface WordData {
  timeMs: number;
  endMs: number;
  text: string;
  isBackground?: boolean;
}

export interface ParsedLyrics {
  braccatoLyrics: Lyric[];
  syncedLines: { timeMs: number; text: string; words?: WordData[] }[];
  plainLyrics: string | null;
}

function tryParseRichsync(raw: string): Lyric[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const lines = JSON.parse(trimmed);
    if (!Array.isArray(lines) || lines.length === 0 || typeof lines[0]?.ts !== "number") {
      return null;
    }
    return lines.map((line: any): Lyric => {
      const startMs = Math.round(line.ts * 1000);
      const endMs = Math.round(line.te * 1000);
      const durationMs = Math.max(0, endMs - startMs);
      const wordsArray: { c: string; o?: number }[] = Array.isArray(line.l) ? line.l : [];

      // Musixmatch richsync emits spaces as standalone tokens { c: " ", o: ... }.
      // Merge whitespace tokens into preceding word so words carry their natural trailing space.
      const mergedWords: { c: string; o?: number }[] = [];
      for (const w of wordsArray) {
        if (!w || typeof w.c !== "string") continue;
        if (w.c.trim().length === 0) {
          if (mergedWords.length > 0) {
            mergedWords[mergedWords.length - 1] = {
              ...mergedWords[mergedWords.length - 1],
              c: mergedWords[mergedWords.length - 1].c + w.c,
            };
          }
        } else {
          mergedWords.push(w);
        }
      }

      const text = mergedWords.map((w) => w.c).join("");

      const parts: LyricPart[] = mergedWords.map((w, i, arr): LyricPart => {
        const rawOffsetMs = Math.round((w.o ?? 0) * 1000);
        const wordStart = rawOffsetMs >= startMs ? rawOffsetMs : startMs + rawOffsetMs;
        const nextRaw = arr[i + 1]?.o;
        const nextWordStart =
          nextRaw !== undefined
            ? (Math.round((nextRaw ?? 0) * 1000) >= startMs
                ? Math.round((nextRaw ?? 0) * 1000)
                : startMs + Math.round((nextRaw ?? 0) * 1000))
            : endMs;
        return {
          startTimeMs: wordStart,
          durationMs: Math.max(0, nextWordStart - wordStart),
          words: w.c,
        };
      });

      return {
        startTimeMs: startMs,
        durationMs,
        words: text,
        parts: parts.length > 0 ? parts : undefined,
      };
    });
  } catch {
    return null;
  }
}

function tryParseMxmSubtitles(raw: string): Lyric[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const lines = JSON.parse(trimmed);
    if (!Array.isArray(lines) || lines.length === 0 || typeof lines[0]?.time?.total !== "number") {
      return null;
    }
    return lines
      .map((line: any): Lyric | null => {
        const text = typeof line.text === "string" ? line.text.trim() : "";
        if (!text) return null;
        const startMs = Math.round(Number(line.time?.total ?? 0) * 1000);
        return {
          startTimeMs: startMs,
          durationMs: 0,
          words: text,
        };
      })
      .filter((l): l is Lyric => Boolean(l));
  } catch {
    return null;
  }
}

export function parseRawLyrics(
  raw: string,
  _format?: string,
  songDurationMs?: number,
): ParsedLyrics {
  if (!raw || !raw.trim()) {
    return { braccatoLyrics: [], syncedLines: [], plainLyrics: null };
  }

  const trimmed = raw.trim();

  try {
    const richsyncLyrics = tryParseRichsync(trimmed);
    const mxmSubtitles = richsyncLyrics ? null : tryParseMxmSubtitles(trimmed);
    const braccatoLyrics: Lyric[] =
      richsyncLyrics ?? mxmSubtitles ?? detectParser(trimmed).parse(trimmed, songDurationMs);

    if (!braccatoLyrics || braccatoLyrics.length === 0) {
      return {
        braccatoLyrics: [],
        syncedLines: [],
        plainLyrics: trimmed || null,
      };
    }

    const syncedLines = braccatoLyrics.map((line) => ({
      timeMs: line.startTimeMs,
      text: line.words,
      words: line.parts?.map((p) => ({
        timeMs: p.startTimeMs,
        endMs: p.startTimeMs + p.durationMs,
        text: p.words,
        isBackground: p.isBackground,
      })),
    }));

    const plainLyrics = braccatoLyrics.map((l) => l.words).join("\n").trim();

    return {
      braccatoLyrics,
      syncedLines,
      plainLyrics: plainLyrics || null,
    };
  } catch {
    return { braccatoLyrics: [], syncedLines: [], plainLyrics: trimmed || null };
  }
}

export function applyLyricsOffset(
  parsed: {
    braccatoLyrics: Lyric[];
    syncedLines: { timeMs: number; text: string; words?: WordData[] }[];
  },
  offsetMs: number,
): {
  braccatoLyrics: Lyric[];
  syncedLines: { timeMs: number; text: string; words?: WordData[] }[];
} {
  if (!offsetMs) {
    return parsed;
  }

  const braccatoLyrics: Lyric[] = parsed.braccatoLyrics.map((line) => {
    const startTimeMs = Math.max(0, line.startTimeMs + offsetMs);
    const parts = line.parts?.map((part) => ({
      ...part,
      startTimeMs: Math.max(0, part.startTimeMs + offsetMs),
    }));
    const timedRomanization = line.timedRomanization?.map((part) => ({
      ...part,
      startTimeMs: Math.max(0, part.startTimeMs + offsetMs),
    }));
    return {
      ...line,
      startTimeMs,
      ...(parts ? { parts } : {}),
      ...(timedRomanization ? { timedRomanization } : {}),
    };
  });

  const syncedLines = parsed.syncedLines.map((line) => {
    const timeMs = Math.max(0, line.timeMs + offsetMs);
    const words = line.words?.map((word) => ({
      ...word,
      timeMs: Math.max(0, word.timeMs + offsetMs),
      endMs: Math.max(0, word.endMs + offsetMs),
    }));
    return {
      ...line,
      timeMs,
      ...(words ? { words } : {}),
    };
  });

  return { braccatoLyrics, syncedLines };
}
