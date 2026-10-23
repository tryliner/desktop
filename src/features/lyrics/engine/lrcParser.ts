import type { SyncedLrcLine } from "@/shared/contracts/lyrics";

export type { SyncedLrcLine };

/**
 * Parses standard LRC content into an array of SyncedLrcLine objects.
 * Handles:
 * - [mm:ss.xx] (centiseconds * 10 ms)
 * - [mm:ss.xxx] (milliseconds)
 * - [offset:+/-ms] global offset tags
 * - Multi-timestamp lines e.g. [00:01.00][00:05.00]Chorus
 * - Filters out malformed tags (e.g. [not:a.time], [99:99.9999]) and metadata tags
 * - Returns clean objects { id, timeMs, text } without extra keys
 */
export function parseLrc(content: string): SyncedLrcLine[] {
  if (!content || typeof content !== "string") {
    return [];
  }

  const rawLines = content.split(/\r?\n/);
  const timeTagRegex = /\[(\d{2,}):(\d{2})\.(\d{2,3})\]/g;
  const offsetRegex = /^\[offset:\s*([+-]?\d+)\s*\]/i;

  let globalOffsetMs = 0;

  // Pass 1: Parse global [offset:+/-ms]
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    const offsetMatch = line.match(offsetRegex);
    if (offsetMatch) {
      const parsedOffset = parseInt(offsetMatch[1], 10);
      if (!Number.isNaN(parsedOffset)) {
        globalOffsetMs += parsedOffset;
      }
    }
  }

  interface IntermediateLine {
    timeMs: number;
    text: string;
  }

  const intermediate: IntermediateLine[] = [];

  // Pass 2: Parse timestamps and lines
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Ignore offset tags and metadata tags like [ar:...], [ti:...], [al:...]
    if (offsetRegex.test(line) || /^\[[a-zA-Z]+:[^\]]*\]$/.test(line)) {
      continue;
    }

    // Find all valid timestamp tags on this line
    const matches = Array.from(line.matchAll(timeTagRegex));
    if (matches.length === 0) {
      continue;
    }

    // Clean text by stripping out all valid timestamp tags
    const cleanText = line.replace(timeTagRegex, "").trim();

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const subSec = match[3];
      const ms = subSec.length === 2 ? parseInt(subSec, 10) * 10 : parseInt(subSec, 10);

      const calculatedTimeMs = minutes * 60 * 1000 + seconds * 1000 + ms + globalOffsetMs;
      const finalTimeMs = Math.max(0, calculatedTimeMs);

      intermediate.push({
        timeMs: finalTimeMs,
        text: cleanText,
      });
    }
  }

  // Sort chronologically by timeMs
  intermediate.sort((a, b) => a.timeMs - b.timeMs);

  // Assign sequential deterministic IDs
  return intermediate.map((item, index) => ({
    id: `line_${index}`,
    timeMs: item.timeMs,
    text: item.text,
  }));
}

/**
 * Returns the 0-based index of the currently active lyric line matching positionMs.
 * Returns -1 if lines is empty or positionMs is before the first line.
 * Returns lines.length - 1 if positionMs is at or past the last line.
 */
export function getActiveLyricIndex(lines: SyncedLrcLine[], positionMs: number): number {
  if (!lines || lines.length === 0) return -1;
  if (positionMs < lines[0].timeMs) return -1;

  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/**
 * Computes the centered vertical scroll offset (in pixels) for the active lyric line.
 * Formula: Math.max(0, activeIndex * lineHeightPx - viewportHeightPx / 2 + lineHeightPx / 2)
 */
export function computeLyricScrollOffset(
  activeIndex: number,
  lineHeightPx: number,
  viewportHeightPx: number,
): number {
  if (activeIndex < 0) return 0;
  return Math.max(0, activeIndex * lineHeightPx - viewportHeightPx / 2 + lineHeightPx / 2);
}

/**
 * Calculates durationMs for each line based on the start timestamp of the next line.
 */
export function computeLrcDurations(
  lines: SyncedLrcLine[],
  totalDurationMs?: number,
): SyncedLrcLine[] {
  return lines.map((line, i) => {
    const nextTime = lines[i + 1]?.timeMs ?? totalDurationMs ?? (line.timeMs + 5000);
    return {
      ...line,
      durationMs: Math.max(0, nextTime - line.timeMs),
    };
  });
}
