import type { TrackAnalysis } from "./trackAnalysis";

/**
 * Decides how one song hands over to the next. Pure: settings and what we
 * know about both songs in, a plan out. Without analysis it falls back to
 * a plain timed crossfade, so a missing analysis never blocks playback.
 */

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
  /** position in the outgoing song (ms) where the handover starts */
  startAtMs: number;
  /** how long the outgoing song takes to fade to silence */
  fadeOutMs: number;
  /** how long the incoming song takes to come up to full level */
  fadeInMs: number;
  /** where the incoming song starts (skips its silent lead-in) */
  incomingOffsetMs: number;
}

/** how early a gapless start fires, to cover the next element's start-up */
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

  const gapless = (): TransitionPlan => ({
    kind: "gapless",
    startAtMs: Math.max(0, end - GAPLESS_LEAD_MS),
    fadeOutMs: 0,
    fadeInMs: 0,
    // an album's own transitions stay exactly as mastered
    incomingOffsetMs: 0,
  });

  // albums (live sets, DJ mixes, concept records) flow straight through
  if (settings.automix && sameAlbum(outgoing, incoming)) {
    return settings.gapless || settings.crossfadeMs > 0 ? gapless() : null;
  }
  if (settings.crossfadeMs <= 0) return settings.gapless ? gapless() : null;

  let overlap = settings.crossfadeMs;
  let fadeOut = overlap;
  let fadeIn = overlap;
  const out = outgoing.analysis;
  const inc = incoming.analysis;

  if (settings.automix && out) {
    if (out.fadesOut && out.outroFadeMs > 0) {
      // the song fades by itself: let it, and bring the next one in under
      // its last part instead of fading it a second time
      overlap = Math.min(overlap, Math.max(1_500, out.outroFadeMs * 0.6));
      fadeOut = Math.min(overlap, 1_500);
      fadeIn = overlap;
    } else if (
      out.outroEnergyDb > -4 &&
      (inc ? inc.introEnergyDb > -4 : false)
    ) {
      // loud into loud: a long blend turns to mush, keep it tight
      overlap = Math.min(overlap, 4_000);
      fadeOut = overlap;
      fadeIn = Math.min(overlap, 2_000);
    } else if (out.outroEnergyDb < -9) {
      // a quiet outro can blend longer
      overlap = Math.min(12_000, Math.round(overlap * 1.25));
      fadeOut = overlap;
      fadeIn = overlap;
    }
  }

  // never let the blend eat more than a third of either song
  const cap = Math.min(end, incoming.durationMs - offset) / 3;
  overlap = Math.min(overlap, cap);
  fadeOut = Math.min(fadeOut, overlap);
  fadeIn = Math.min(fadeIn, overlap);
  if (overlap < 500) return null;

  return {
    kind: "crossfade",
    startAtMs: Math.max(0, Math.round(end - overlap)),
    fadeOutMs: Math.round(fadeOut),
    fadeInMs: Math.round(fadeIn),
    incomingOffsetMs: Math.round(offset),
  };
}

/** volume multiplier for "normalize volume": only ever turns loud songs down */
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

/** equal-power fade-out: cos curve, so two songs blending keep their loudness */
export function fadeOutLevel(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.cos((p * Math.PI) / 2);
}

export function fadeInLevel(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.sin((p * Math.PI) / 2);
}
