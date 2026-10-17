/**
 * Pure timing helpers for the lyrics animator: an eased crossfade between
 * consecutive words, and the active-line lookup used for next-line pre-warming.
 * No React or DOM imports, so everything here is unit-testable.
 */

export interface TimedWord {
  timeMs: number;
  endMs: number;
}

export interface TimedLine {
  timeMs: number;
  text: string;
}

/** Overlap where the outgoing item fades out while the incoming one fades in (50-100ms). */
export const CROSSFADE_MS = 80;

/**
 * How far ahead of its timestamp the active-line callback fires, so the DOM
 * update and the CSS transition are already under way when the line's time hits.
 * Rule of thumb: about half the line transition's duration, so the transition is
 * midway at the timestamp. Keep >= CROSSFADE_MS / 2.
 */
export const PREWARM_MS = 160;

const clamp01 = (n: number) =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

/** Non-linear ease-in-out (cubic). Input and output are 0..1. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * Eased handoff centred on `boundaryMs`. The window is
 * [boundary - buffer/2, boundary + buffer/2], so at the boundary itself both
 * sides sit at 0.5. The window never starts before 0, so an item at timeMs 0
 * (e.g. after a large negative offset) fades in from 0 instead of starting half-visible.
 * bufferMs <= 0 gives a hard cut.
 */
export function crossfade(
  estimatedMs: number,
  boundaryMs: number,
  bufferMs = CROSSFADE_MS,
): { incoming: number; outgoing: number } {
  let t: number;
  if (bufferMs <= 0) {
    t = estimatedMs >= boundaryMs ? 1 : 0;
  } else {
    const start = Math.max(0, boundaryMs - bufferMs / 2);
    t = (estimatedMs - start) / bufferMs;
  }
  const incoming = easeInOutCubic(t);
  return { incoming, outgoing: 1 - incoming };
}

/**
 * 0..1 "how current is this word". Consecutive words overlap at their shared
 * boundary (both ~0.5). Words shorter than bufferMs are held for one buffer so
 * the fade stays visible. Drive the active-word look (brightness, glow, lift)
 * with this; keep the fill percentage linear, since it tracks the singer.
 */
export function wordEmphasis(
  estimatedMs: number,
  word: TimedWord,
  bufferMs = CROSSFADE_MS,
): number {
  const end = Math.max(word.endMs, word.timeMs + bufferMs);
  const fadeIn = crossfade(estimatedMs, word.timeMs, bufferMs).incoming;
  const fadeOut = crossfade(estimatedMs, end, bufferMs).outgoing;
  return Math.min(fadeIn, fadeOut);
}

/** Lines whose text starts with a <tag> ride along with the main line before them. */
const TAG_PREFIXED_LINE = /^\s*<[^>]+>/;

/**
 * Indices of the lines that are active at `ms`: the last non-tag line whose
 * timeMs has been reached, plus any tag-prefixed lines directly after it that
 * have also been reached. Same rules as the loops that used to live inline in
 * useLyricsAnimator. Call it with the real time plus a capped pre-warm lead.
 */
export function getActiveLineIndices(
  lines: ReadonlyArray<TimedLine>,
  ms: number,
): number[] {
  let main = -1;
  for (let i = 0; i < lines.length; i++) {
    if (ms >= lines[i].timeMs) {
      if (!TAG_PREFIXED_LINE.test(lines[i].text)) main = i;
    } else {
      break;
    }
  }

  const active: number[] = [];
  if (main >= 0) {
    active.push(main);
    for (let i = main + 1; i < lines.length; i++) {
      if (TAG_PREFIXED_LINE.test(lines[i].text)) {
        if (ms >= lines[i].timeMs) active.push(i);
      } else {
        break;
      }
    }
  }
  return active;
}

/**
 * Limit the projected clock to the next line boundary. When lines are close
 * together, this shortens the pre-warm so a later line cannot replace the next
 * line before that next line has started.
 */
export function getPrewarmLeadMs(
  lines: ReadonlyArray<TimedLine>,
  estimatedMs: number,
  maxLeadMs = PREWARM_MS,
): number {
  const maxLead = Number.isFinite(maxLeadMs) ? Math.max(0, maxLeadMs) : 0;
  if (!Number.isFinite(estimatedMs) || maxLead === 0) return 0;

  const nextLine = lines.find((line) => line.timeMs > estimatedMs);
  return nextLine
    ? Math.min(maxLead, nextLine.timeMs - estimatedMs)
    : maxLead;
}

/** Lines whose final timed word is still being sung stay active through that word. */
export function getUnfinishedOutgoingLineIndices(
  candidateIndices: ReadonlyArray<number>,
  prewarmedIndices: ReadonlyArray<number>,
  lastWordEndByLine: ReadonlyMap<number, number>,
  estimatedMs: number,
): number[] {
  const prewarmed = new Set(prewarmedIndices);
  return [...new Set(candidateIndices)]
    .filter(
      (index) =>
        !prewarmed.has(index) &&
        (lastWordEndByLine.get(index) ?? -Infinity) > estimatedMs,
    )
    .sort((a, b) => a - b);
}
