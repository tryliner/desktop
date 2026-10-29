import type { Lyric, LyricPart } from "@braccato/parsers";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function jsonLines(raw: string): Record<string, unknown>[] | null {
  if (!raw.trim().startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every(record)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function tryParseRichsync(raw: string): Lyric[] | null {
  const lines = jsonLines(raw);
  if (!lines || !lines.every((line) => typeof line.ts === "number"))
    return null;
  return lines.map((line): Lyric => {
    const startMs = Math.round(Number(line.ts) * 1000);
    const endMs = Math.round(Number(line.te ?? line.ts) * 1000);
    const words = Array.isArray(line.l) ? line.l.filter(record) : [];
    const merged: { c: string; o?: number }[] = [];
    for (const word of words) {
      if (typeof word.c !== "string") continue;
      if (word.c.trim().length === 0) {
        if (merged.length > 0) merged[merged.length - 1].c += word.c;
      } else
        merged.push({
          c: word.c,
          o: typeof word.o === "number" ? word.o : undefined,
        });
    }
    const parts: LyricPart[] = merged.map((word, i, all) => {
      const offset = Math.round((word.o ?? 0) * 1000);
      const next = all[i + 1]?.o;
      const nextMs = next === undefined ? endMs : Math.round(next * 1000);
      const start = offset >= startMs ? offset : startMs + offset;
      const end =
        next === undefined || nextMs >= startMs ? nextMs : startMs + nextMs;
      return {
        startTimeMs: start,
        durationMs: Math.max(0, end - start),
        words: word.c,
      };
    });
    return {
      startTimeMs: startMs,
      durationMs: Math.max(0, endMs - startMs),
      words: merged.map((word) => word.c).join(""),
      parts: parts.length > 0 ? parts : undefined,
    };
  });
}

export function tryParseMxmSubtitles(raw: string): Lyric[] | null {
  const lines = jsonLines(raw);
  if (
    !lines ||
    !record(lines[0].time) ||
    typeof lines[0].time.total !== "number"
  )
    return null;
  return lines.flatMap((line): Lyric[] => {
    const words = typeof line.text === "string" ? line.text.trim() : "";
    if (!words) return [];
    return [
      {
        startTimeMs: Math.round(
          Number(record(line.time) ? (line.time.total ?? 0) : 0) * 1000,
        ),
        durationMs: 0,
        words,
      },
    ];
  });
}
