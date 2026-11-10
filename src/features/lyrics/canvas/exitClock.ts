import { clamp01, cssEase } from "./easing";
import type { LyricLineModel } from "./types";

const FADE_OUT_MS = 500;
const LINE_END_PAD_MS = 50;
// the media clock steps back a little when it re-anchors; only a bigger jump
// back (a seek or a replay) starts the line over
const REWIND_MS = 200;
const seenAt = new WeakMap<LyricLineModel, number>();

export function lineExitMs(line: LyricLineModel): number {
  return Math.max(line.nextStartMs, line.endMs + LINE_END_PAD_MS);
}

export function exitElapsedMs(
  line: LyricLineModel,
  timeMs: number,
  now: number,
): number | null {
  const exit = lineExitMs(line);
  if (timeMs < exit) {
    if (timeMs < exit - REWIND_MS) seenAt.delete(line);
    return null;
  }
  const mediaElapsed = timeMs - exit;
  const seen = seenAt.get(line) ?? now - mediaElapsed;
  seenAt.set(line, seen);
  return Math.max(mediaElapsed, now - seen);
}

export function exitFade(
  line: LyricLineModel,
  timeMs: number,
  now: number,
): number {
  const elapsed = exitElapsedMs(line, timeMs, now);
  if (elapsed === null) return 1;
  return 1 - cssEase(clamp01(elapsed / FADE_OUT_MS));
}

export function isExiting(
  line: LyricLineModel,
  timeMs: number,
  now: number,
): boolean {
  const elapsed = exitElapsedMs(line, timeMs, now);
  return elapsed !== null && elapsed < FADE_OUT_MS + 50;
}
