import { clamp01, cssEase } from "./easing";
import { exitFade, isExiting, lineExitMs } from "./exitClock";
import type { LyricLineModel, LyricToken } from "./types";

const SWIPE_LEAD_RATIO = 0.1;
const SWIPE_DURATION_RATIO = 1.6;
const SWIPE_START_FROM = -0.2;
const SWIPE_START_TO = 1.4;
const SWIPE_WIDTH = 0.1;
const FADE_IN_MS = 330;
const SETUP_EARLY_MS = 2000;
const LONG_WORD_MS = 1500;
const GLOW_RATIO = 1.2;
const GLOW_MIN_MS = 1200;
const GLOW_RADIUS_REM = 0.8;

export interface TokenHighlight {
  opacity: number;
  solid: number;
  clear: number;
  glowRem: number;
}

export function isLineSelected(line: LyricLineModel, timeMs: number) {
  return timeMs + SETUP_EARLY_MS >= line.startMs && timeMs < lineExitMs(line);
}

function sweepAt(token: LyricToken, elapsedMs: number): number {
  const swipeMs = token.durationMs * SWIPE_DURATION_RATIO;
  const swipeTime = Math.min(
    elapsedMs + token.durationMs * SWIPE_LEAD_RATIO,
    swipeMs,
  );
  return (
    SWIPE_START_FROM +
    ((SWIPE_START_TO - SWIPE_START_FROM) * swipeTime) / swipeMs
  );
}

function glowAt(token: LyricToken, elapsedMs: number): number {
  if (token.durationMs <= LONG_WORD_MS) return 0;
  const glowMs = Math.max(token.durationMs * GLOW_RATIO, GLOW_MIN_MS);
  if (elapsedMs >= glowMs) return 0;
  return GLOW_RADIUS_REM * (1 - cssEase(elapsedMs / glowMs));
}

export function tokenHighlight(
  token: LyricToken,
  line: LyricLineModel,
  timeMs: number,
  now: number,
): TokenHighlight | null {
  const exit = lineExitMs(line);
  if (timeMs < token.startMs || token.startMs > exit) return null;
  const elapsed = timeMs - token.startMs;
  if (timeMs >= exit) {
    const opacity = exitFade(line, timeMs, now);
    if (opacity <= 0) return null;
    return {
      opacity,
      solid: SWIPE_START_TO,
      clear: SWIPE_START_TO,
      glowRem: 0,
    };
  }
  if (token.durationMs <= 0) {
    const opacity = cssEase(clamp01(elapsed / FADE_IN_MS));
    return {
      opacity,
      solid: SWIPE_START_TO,
      clear: SWIPE_START_TO,
      glowRem: 0,
    };
  }
  const solid = sweepAt(token, elapsed);
  return {
    opacity: 1,
    solid,
    clear: solid + SWIPE_WIDTH,
    glowRem: glowAt(token, elapsed),
  };
}

function tokenSettleMs(token: LyricToken): number {
  if (token.durationMs <= 0) return FADE_IN_MS;
  const sweep = token.durationMs * SWIPE_DURATION_RATIO;
  if (token.durationMs <= LONG_WORD_MS) return sweep;
  return Math.max(sweep, token.durationMs * GLOW_RATIO, GLOW_MIN_MS);
}

export function isLineAnimating(
  line: LyricLineModel,
  timeMs: number,
  now: number,
) {
  // asked before the exit check too, so a replayed line forgets its old exit
  // and fades out again instead of dropping its highlight at once
  const exiting = isExiting(line, timeMs, now);
  if (timeMs >= lineExitMs(line)) return exiting;
  if (!isLineSelected(line, timeMs)) return false;
  if (line.instrumental) return true;
  return line.tokens.some(
    (token) =>
      !token.space &&
      timeMs >= token.startMs - 50 &&
      timeMs <= token.startMs + tokenSettleMs(token) + 50,
  );
}

export { lineExitMs };
