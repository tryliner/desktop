/**
 * What AutoMix needs to know about a song, worked out once from its audio
 * and cached: how much silence it starts and ends with, how loud it is,
 * how energetic its first and last seconds are, and whether it already
 * fades out on its own (so a crossfade shouldn't fade it twice).
 */

export const ANALYSIS_VERSION = 1;
export const FRAME_MS = 50;
const SILENCE_DB = -50;
const EDGE_WINDOW_MS = 15_000;

export interface TrackAnalysis {
  version: number;
  durationMs: number;
  /** quiet lead-in to skip when this song comes in */
  leadingSilenceMs: number;
  /** quiet tail (and encoder padding) after the music stops */
  trailingSilenceMs: number;
  /** average level of the audible parts, dB (RMS, not true LUFS) */
  loudnessDb: number;
  /** level of the first / last 15 s relative to the whole song, dB */
  introEnergyDb: number;
  outroEnergyDb: number;
  /** the song's own fade-out at the end, if it has one */
  fadesOut: boolean;
  outroFadeMs: number;
}

const toDb = (power: number) => (power > 1e-12 ? 10 * Math.log10(power) : -120);

/** RMS level per frame, in dBFS */
export function frameLevels(
  samples: Float32Array,
  sampleRate: number,
  frameMs = FRAME_MS,
): Float32Array {
  const size = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const frames = Math.ceil(samples.length / size);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * size;
    const end = Math.min(samples.length, start + size);
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    out[f] = toDb(sum / Math.max(1, end - start));
  }
  return out;
}

function meanDb(levels: Float32Array, from: number, to: number): number {
  let power = 0;
  let count = 0;
  for (let i = Math.max(0, from); i < Math.min(levels.length, to); i++) {
    if (levels[i] <= SILENCE_DB) continue;
    power += 10 ** (levels[i] / 10);
    count++;
  }
  return count ? toDb(power / count) : -120;
}

/** smooths a level curve so single quiet beats don't read as a fade */
function smooth(levels: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(levels.length);
  for (let i = 0; i < levels.length; i++) {
    let power = 0;
    let n = 0;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j < 0 || j >= levels.length) continue;
      power += 10 ** (levels[j] / 10);
      n++;
    }
    out[i] = toDb(power / n);
  }
  return out;
}

export function analyzeLevels(
  levels: Float32Array,
  frameMs = FRAME_MS,
): TrackAnalysis {
  const frames = levels.length;
  const durationMs = frames * frameMs;
  let first = 0;
  while (first < frames && levels[first] <= SILENCE_DB) first++;
  let last = frames - 1;
  while (last > first && levels[last] <= SILENCE_DB) last--;
  if (first >= frames) {
    return {
      version: ANALYSIS_VERSION,
      durationMs,
      leadingSilenceMs: 0,
      trailingSilenceMs: 0,
      loudnessDb: -120,
      introEnergyDb: 0,
      outroEnergyDb: 0,
      fadesOut: false,
      outroFadeMs: 0,
    };
  }
  const edge = Math.round(EDGE_WINDOW_MS / frameMs);
  const loudness = meanDb(levels, first, last + 1);
  const intro = meanDb(levels, first, first + edge) - loudness;
  const outro = meanDb(levels, last + 1 - edge, last + 1) - loudness;

  // a fade-out: the smoothed level falls steadily by 12 dB+ into the end
  const smoothed = smooth(levels, Math.round(500 / frameMs));
  const body = loudness;
  let fadeStart = last;
  for (let i = last; i > first; i--) {
    if (smoothed[i] >= body - 3) break;
    fadeStart = i;
  }
  const fadeFrames = last - fadeStart;
  const fadeDrop = body - smoothed[last];
  const fadesOut =
    fadeFrames * frameMs >= 2_500 &&
    fadeFrames * frameMs <= 30_000 &&
    fadeDrop >= 12;

  return {
    version: ANALYSIS_VERSION,
    durationMs,
    leadingSilenceMs: first * frameMs,
    trailingSilenceMs: (frames - 1 - last) * frameMs,
    loudnessDb: Math.round(loudness * 10) / 10,
    introEnergyDb: Math.round(intro * 10) / 10,
    outroEnergyDb: Math.round(outro * 10) / 10,
    fadesOut,
    outroFadeMs: fadesOut ? fadeFrames * frameMs : 0,
  };
}

/** mono mix of all channels */
export function mixDown(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i++) out[i] += channel[i] / channels.length;
  }
  return out;
}

const DECODE_RATE = 11_025;
const MAX_ANALYSE_MS = 15 * 60_000;

/**
 * Decodes at 11 kHz (plenty for levels) to keep memory low: a 4-minute
 * song is ~20 MB of samples for a moment instead of ~85 MB at 44.1 kHz.
 */
export async function analyzeAudioBlob(
  blob: Blob,
): Promise<TrackAnalysis | null> {
  const OfflineCtx =
    typeof window !== "undefined"
      ? window.OfflineAudioContext ||
        (
          window as unknown as {
            webkitOfflineAudioContext?: typeof OfflineAudioContext;
          }
        ).webkitOfflineAudioContext
      : undefined;
  if (!OfflineCtx) return null;
  try {
    const ctx = new OfflineCtx(1, DECODE_RATE, DECODE_RATE);
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration * 1000 > MAX_ANALYSE_MS) return null;
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
      decoded.getChannelData(i),
    );
    return analyzeLevels(frameLevels(mixDown(channels), decoded.sampleRate));
  } catch {
    return null;
  }
}
