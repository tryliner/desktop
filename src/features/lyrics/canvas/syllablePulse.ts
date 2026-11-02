import type { LyricToken } from "./types";

const MIN_PULSE_MS = 60;
const ATTACK_MS = 100;
const PEAK_GLOW_REM = 0.95;
const SUSTAIN_GLOW_REM = 0.4;

export interface SyllableEffect {
  scale: number;
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
    return { scale: 1, glowRem: 0 };
  }

  const attackDuration = Math.min(ATTACK_MS, token.durationMs * 0.4);
  let glowRem = 0;

  if (elapsedMs <= attackDuration) {
    const progress = elapsedMs / attackDuration;
    glowRem = PEAK_GLOW_REM * Math.sin(progress * Math.PI * 0.5);
  } else {
    const sustainProgress =
      (elapsedMs - attackDuration) /
      Math.max(1, token.durationMs - attackDuration);
    const decay =
      SUSTAIN_GLOW_REM +
      (PEAK_GLOW_REM - SUSTAIN_GLOW_REM) *
        Math.cos(sustainProgress * Math.PI * 0.5);

    const vibrato =
      token.durationMs >= 450
        ? 0.12 *
          Math.sin((elapsedMs - attackDuration) * 0.015) *
          (1 - sustainProgress)
        : 0;

    glowRem = Math.max(0, decay + vibrato);
  }

  return {
    scale: 1,
    glowRem: Math.max(0, Math.min(1.2, glowRem)),
  };
}
