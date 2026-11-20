import type { TrackAnalysis } from "./trackAnalysis";

export interface TransitionSettings {
  crossfadeMs: number;
  gapless: boolean;
  automix: boolean;
  normalize: boolean;
}

export interface TransitionSide {
  durationMs: number;
  analysis?: TrackAnalysis | null;
  albumId?: string | null;
}

export interface TransitionPlan {
  kind: "crossfade" | "gapless";
  startAtMs: number;
  fadeOutMs: number;
  fadeOutDelayMs: number;
  fadeInMs: number;
  incomingOffsetMs: number;
}

export const GAPLESS_LEAD_MS = 120;
const MIN_SONG_MS = 20_000;
const MAX_LEAD_IN_SKIP_MS = 5_000;
const MAX_TRAIL_TRIM_MS = 12_000;
const NORMALIZE_TARGET_DB = -12;
const NORMALIZE_MAX_CUT_DB = 6;

function usableEnd(side: TransitionSide, automix: boolean): number {
  const trail = automix
    ? Math.min(side.analysis?.trailingSilenceMs ?? 0, MAX_TRAIL_TRIM_MS)
    : 0;
  return Math.max(0, side.durationMs - trail);
}

function leadIn(side: TransitionSide, automix: boolean): number {
  return automix
    ? Math.min(side.analysis?.leadingSilenceMs ?? 0, MAX_LEAD_IN_SKIP_MS)
    : 0;
}

export function sameAlbum(a: TransitionSide, b: TransitionSide): boolean {
  return Boolean(a.albumId && b.albumId && a.albumId === b.albumId);
}

export function planTransition(
  settings: TransitionSettings,
  outgoing: TransitionSide,
  incoming: TransitionSide,
): TransitionPlan | null {
  if (outgoing.durationMs < MIN_SONG_MS || incoming.durationMs <= 0) {
    return null;
  }
  const end = usableEnd(outgoing, settings.automix);
  const offset = leadIn(incoming, settings.automix);

  const gapless = (untilMs: number): TransitionPlan => ({
    kind: "gapless",
    startAtMs: Math.max(0, untilMs - GAPLESS_LEAD_MS),
    fadeOutMs: 0,
    fadeOutDelayMs: 0,
    fadeInMs: 0,
    incomingOffsetMs: 0,
  });

  if (settings.automix && sameAlbum(outgoing, incoming)) {
    return settings.gapless || settings.crossfadeMs > 0
      ? gapless(outgoing.durationMs)
      : null;
  }
  if (settings.crossfadeMs <= 0) {
    return settings.gapless ? gapless(end) : null;
  }

  let overlap = settings.crossfadeMs;
  let fadeOut = overlap;
  let fadeIn = overlap;
  const out = outgoing.analysis;
  const inc = incoming.analysis;

  if (settings.automix && out) {
    if (out.fadesOut && out.outroFadeMs > 0) {
      overlap = Math.min(overlap, Math.max(1_500, out.outroFadeMs * 0.6));
      fadeOut = Math.min(overlap, 1_500);
      fadeIn = overlap;
    } else if (
      out.outroEnergyDb > -4 &&
      (inc ? inc.introEnergyDb > -4 : false)
    ) {
      overlap = Math.min(overlap, 4_000);
      fadeOut = overlap;
      fadeIn = Math.min(overlap, 2_000);
    } else if (out.outroEnergyDb < -9) {
      overlap = Math.min(12_000, Math.round(overlap * 1.25));
      fadeOut = overlap;
      fadeIn = overlap;
    }
  }

  const cap = Math.min(end, incoming.durationMs - offset) / 3;
  overlap = Math.min(overlap, cap);
  fadeOut = Math.min(fadeOut, overlap);
  fadeIn = Math.min(fadeIn, overlap);
  if (overlap < 500) return null;

  return {
    kind: "crossfade",
    startAtMs: Math.max(0, Math.round(end - overlap)),
    fadeOutMs: Math.round(fadeOut),
    fadeOutDelayMs: Math.round(overlap - fadeOut),
    fadeInMs: Math.round(fadeIn),
    incomingOffsetMs: Math.round(offset),
  };
}

export function normalizeGain(
  analysis: TrackAnalysis | null | undefined,
): number {
  if (!analysis || analysis.loudnessDb <= -100) return 1;
  const cut = Math.min(
    NORMALIZE_MAX_CUT_DB,
    Math.max(0, analysis.loudnessDb - NORMALIZE_TARGET_DB),
  );
  return 10 ** (-cut / 20);
}

export function fadeOutLevel(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.cos((p * Math.PI) / 2);
}

export function fadeInLevel(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.sin((p * Math.PI) / 2);
}
