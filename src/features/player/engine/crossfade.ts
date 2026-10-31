import type { Track } from "@/shared/types";

export const MAX_CROSSFADE_SECONDS = 12;
export const SKIP_FADE_MS = 300;
export const GAPLESS_HEAD_START_MS = 40;
export const TRANSITION_ARM_WINDOW_MS = 1000;

export function clampCrossfadeSeconds(seconds: unknown): number {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.min(MAX_CROSSFADE_SECONDS, Math.round(seconds)));
}

export function transitionMs(
  current: Track | null,
  next: Track,
  crossfadeSeconds: number,
): number {
  const album = current?.album?.id;
  if (crossfadeSeconds <= 0 || (album && album === next.album?.id)) return 0;
  const half = (ms?: number) => (ms ? ms / 2 : Infinity);
  return Math.min(
    crossfadeSeconds * 1000,
    half(current?.durationMs),
    half(next.durationMs),
  );
}

export function transitionTiming(
  remainingMs: number,
  wantedFadeMs: number,
): { fadeMs: number; startInMs: number } {
  const fadeMs = Math.max(0, Math.min(wantedFadeMs, remainingMs));
  return {
    fadeMs,
    startInMs: remainingMs - (fadeMs || GAPLESS_HEAD_START_MS),
  };
}
