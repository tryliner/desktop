export const ANALYSIS_VERSION = 1;
export const FRAME_MS = 50;
const SILENCE_DB = -50;
const EDGE_WINDOW_MS = 15_000;

export interface TrackAnalysis {
  version: number;
  durationMs: number;
  leadingSilenceMs: number;
  trailingSilenceMs: number;
  loudnessDb: number;
  introEnergyDb: number;
  outroEnergyDb: number;
  fadesOut: boolean;
  outroFadeMs: number;
}

const toDb = (power: number) => (power > 1e-12 ? 10 * Math.log10(power) : -120);

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
