import type { LyricToken } from "./types";

const MIN_SUSTAINED_MS = 320;
const BOUNCE_ATTACK_MS = 140;
const MAX_BOUNCE_SCALE = 1.075;

export interface SyllableEffect {
  scale: number;
  glowRem: number;
}

export function syllablePulse(
  token: LyricToken,
  elapsedMs: number,
): SyllableEffect {
  if (
    token.durationMs < MIN_SUSTAINED_MS ||
    elapsedMs < 0 ||
    elapsedMs >= token.durationMs
  ) {
    return { scale: 1, glowRem: 0 };
  }

  let scale = 1;
  if (elapsedMs <= BOUNCE_ATTACK_MS) {
    const p = elapsedMs / BOUNCE_ATTACK_MS;
    scale = 1 + (MAX_BOUNCE_SCALE - 1) * Math.sin(p * Math.PI * 0.5);
  } else {
    const holdMs = token.durationMs - BOUNCE_ATTACK_MS;
    const holdProgress = Math.min(
      1,
      (elapsedMs - BOUNCE_ATTACK_MS) / Math.max(1, holdMs),
    );
    const settle =
      1 + (MAX_BOUNCE_SCALE - 1) * Math.cos(holdProgress * Math.PI * 0.5);
    const vibrato =
      token.durationMs >= 600
        ? 0.015 *
          Math.sin((elapsedMs - BOUNCE_ATTACK_MS) * 0.015) *
          (1 - holdProgress)
        : 0;
    scale = Math.max(1, settle + vibrato);
  }

  const normProgress = Math.min(1, elapsedMs / token.durationMs);
  const glowRem = 0.55 * Math.sin(normProgress * Math.PI);

  return {
    scale: Math.min(scale, 1.1),
    glowRem: Math.max(0, glowRem),
  };
}
