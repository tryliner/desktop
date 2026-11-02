import type { LyricToken } from "./types";

const MIN_PULSE_MS = 50;
const ATTACK_MS = 140;
const MAX_BOUNCE_SCALE = 1.065;
const MAX_BOUNCE_LIFT = -3.0;
const PEAK_GLOW_REM = 0.85;
const SUSTAIN_GLOW_REM = 0.35;

export interface SyllableEffect {
  scale: number;
  dy: number;
  glowRem: number;
}

export function syllablePulse(
  token: LyricToken,
  elapsedMs: number,
): SyllableEffect {
  if (
    token.durationMs < MIN_PULSE_MS ||
    elapsedMs < 0 ||
    elapsedMs >= token.durationMs
  ) {
    return { scale: 1, dy: 0, glowRem: 0 };
  }

  const attackDuration = Math.min(ATTACK_MS, token.durationMs * 0.6);

  if (elapsedMs <= attackDuration) {
    const p = elapsedMs / attackDuration;
    const wave = Math.sin(p * Math.PI);
    return {
      scale: 1 + (MAX_BOUNCE_SCALE - 1) * wave,
      dy: MAX_BOUNCE_LIFT * wave,
      glowRem: PEAK_GLOW_REM * wave,
    };
  }

  const sustainMs = Math.max(1, token.durationMs - attackDuration);
  const sustainProgress = (elapsedMs - attackDuration) / sustainMs;
  const decay =
    SUSTAIN_GLOW_REM * Math.cos(sustainProgress * Math.PI * 0.5);

  const isHeldNote = token.durationMs >= 450;
  const vibrato = isHeldNote
    ? Math.sin((elapsedMs - attackDuration) * 0.015) * (1 - sustainProgress)
    : 0;

  return {
    scale: 1,
    dy: isHeldNote ? -0.6 * Math.max(0, vibrato) : 0,
    glowRem: Math.max(0, decay + 0.12 * vibrato),
  };
}
