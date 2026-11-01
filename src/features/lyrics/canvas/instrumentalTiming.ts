import { clamp01, cssEase } from "./easing";
import { exitFade, lineExitMs } from "./exitClock";
import { isLineSelected } from "./timing";
import type { LyricLineModel } from "./types";

const FILL_FADE_MS = 150;
const FILL_FROM = 0.78;
const FILL_TO = -0.04;
const REST_SHIFT = 0;
const WAVE_FROM = 1.2;
const WAVE_TO = 0.0001;

export interface InstrumentalState {
  opacity: number;
  shift: number;
  height: number;
  phaseMs: number;
}

export function instrumentalState(
  line: LyricLineModel,
  timeMs: number,
  waveEasing: (value: number) => number,
  now: number,
): InstrumentalState | null {
  const elapsed = timeMs - line.startMs;
  const durationMs = Math.max(line.durationMs, 1);
  if (timeMs >= lineExitMs(line)) {
    const opacity = exitFade(line, timeMs, now);
    if (opacity <= 0) return null;
    return { opacity, shift: REST_SHIFT, height: WAVE_FROM, phaseMs: 0 };
  }
  if (!isLineSelected(line, timeMs)) return null;
  const progress = clamp01(elapsed / durationMs);
  return {
    opacity: elapsed < 0 ? 1 : cssEase(clamp01(elapsed / FILL_FADE_MS)),
    shift: FILL_FROM + (FILL_TO - FILL_FROM) * progress,
    height: WAVE_FROM + (WAVE_TO - WAVE_FROM) * waveEasing(progress),
    phaseMs: elapsed,
  };
}
