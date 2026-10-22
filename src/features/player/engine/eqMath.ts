// 10-band graphic equaliser: band layout, presets and the filter maths shared
// by the audio graph (pitchShifter) and the UI response curve.
//
// The curve and the anti-clipping preamp come from the exact transfer function
// of the Web Audio BiquadFilterNodes we create (RBJ audio-EQ cookbook, the same
// formulas the Web Audio spec uses), so what you see is what you hear.

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_BAND_COUNT = EQ_FREQUENCIES.length;
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const EQ_STEP_DB = 0.5;
/** one-octave bands */
export const EQ_PEAKING_Q = 1.41;

export type EqFilterKind = "lowshelf" | "peaking" | "highshelf";

// every band is a peaking filter (classic graphic EQ), so each slider's dot
// sits on the drawn curve; shelves would only reach half their gain at the
// edge sliders. Shelf maths stays available below for other uses.
export function bandKind(_index: number): EqFilterKind {
  return "peaking";
}

export const EQ_PRESET_IDS = [
  "flat",
  "bass_boost",
  "bass_cut",
  "treble",
  "vocal",
  "rock",
  "pop",
  "electronic",
  "hiphop",
  "acoustic",
] as const;

export type EqPresetId = (typeof EQ_PRESET_IDS)[number];

export const EQ_PRESETS: Record<EqPresetId, readonly number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass_boost: [6, 5.5, 4.5, 3, 1.5, 0, 0, 0, 0, 0],
  bass_cut: [-6, -5, -4, -2.5, -1, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 1, 2.5, 4, 5, 5.5],
  vocal: [-2, -2, -1, 1, 3, 4, 3.5, 2, 0.5, 0],
  rock: [4.5, 3.5, 2, 0.5, -1, -0.5, 1.5, 3, 4, 4.5],
  pop: [-1, 0, 1.5, 3, 3.5, 2.5, 1, 0, -0.5, -1],
  electronic: [5, 4.5, 2, 0, -1.5, 1, 0.5, 1.5, 4, 5],
  hiphop: [5, 4.5, 2.5, 1.5, -0.5, -0.5, 1, 0, 1.5, 2.5],
  acoustic: [3, 2.5, 2, 1, 1.5, 1.5, 2.5, 3, 2.5, 1.5],
};

export function clampBandDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  const stepped = Math.round(db / EQ_STEP_DB) * EQ_STEP_DB;
  return Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, Number(stepped.toFixed(1))));
}

/** sanitise persisted / external band arrays */
export function normalizeBands(input: unknown): number[] {
  const out = new Array<number>(EQ_BAND_COUNT).fill(0);
  if (!Array.isArray(input)) return out;
  for (let i = 0; i < EQ_BAND_COUNT; i++) {
    const v = input[i];
    out[i] = typeof v === "number" ? clampBandDb(v) : 0;
  }
  return out;
}

export function presetForBands(bands: readonly number[]): EqPresetId | "custom" {
  for (const id of EQ_PRESET_IDS) {
    const p = EQ_PRESETS[id];
    if (p.every((v, i) => Math.abs(v - (bands[i] ?? 0)) < 0.01)) return id;
  }
  return "custom";
}

export function isFlat(bands: readonly number[]): boolean {
  return bands.every((v) => Math.abs(v) < 0.01);
}

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

function coefficients(kind: EqFilterKind, f0: number, gainDb: number, sampleRate: number): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);

  if (kind === "peaking") {
    const alpha = sin / (2 * EQ_PEAKING_Q);
    return {
      b0: 1 + alpha * A,
      b1: -2 * cos,
      b2: 1 - alpha * A,
      a0: 1 + alpha / A,
      a1: -2 * cos,
      a2: 1 - alpha / A,
    };
  }

  // shelves with slope S = 1 (what Web Audio uses)
  const alpha = (sin / 2) * Math.SQRT2;
  const sqA = 2 * Math.sqrt(A) * alpha;
  if (kind === "lowshelf") {
    return {
      b0: A * (A + 1 - (A - 1) * cos + sqA),
      b1: 2 * A * (A - 1 - (A + 1) * cos),
      b2: A * (A + 1 - (A - 1) * cos - sqA),
      a0: A + 1 + (A - 1) * cos + sqA,
      a1: -2 * (A - 1 + (A + 1) * cos),
      a2: A + 1 + (A - 1) * cos - sqA,
    };
  }
  return {
    b0: A * (A + 1 + (A - 1) * cos + sqA),
    b1: -2 * A * (A - 1 + (A + 1) * cos),
    b2: A * (A + 1 + (A - 1) * cos - sqA),
    a0: A + 1 - (A - 1) * cos + sqA,
    a1: 2 * (A - 1 - (A + 1) * cos),
    a2: A + 1 - (A - 1) * cos - sqA,
  };
}

function magnitudeDb(c: Biquad, freq: number, sampleRate: number): number {
  const w = (2 * Math.PI * freq) / sampleRate;
  const cos1 = Math.cos(w);
  const sin1 = Math.sin(w);
  const cos2 = Math.cos(2 * w);
  const sin2 = Math.sin(2 * w);
  const numRe = c.b0 + c.b1 * cos1 + c.b2 * cos2;
  const numIm = -(c.b1 * sin1 + c.b2 * sin2);
  const denRe = c.a0 + c.a1 * cos1 + c.a2 * cos2;
  const denIm = -(c.a1 * sin1 + c.a2 * sin2);
  const num = numRe * numRe + numIm * numIm;
  const den = denRe * denRe + denIm * denIm;
  return 10 * Math.log10(num / den);
}

/** combined response of all bands at `freq`, in dB */
export function responseDb(bands: readonly number[], freq: number, sampleRate = 48000): number {
  let total = 0;
  for (let i = 0; i < EQ_BAND_COUNT; i++) {
    const g = bands[i] ?? 0;
    if (Math.abs(g) < 1e-6) continue;
    total += magnitudeDb(coefficients(bandKind(i), EQ_FREQUENCIES[i], g, sampleRate), freq, sampleRate);
  }
  return total;
}

/** log-spaced frequencies across the audible range */
export function logFrequencies(count: number, min = 20, max = 20000): number[] {
  const out: number[] = [];
  const lmin = Math.log10(min);
  const lmax = Math.log10(max);
  for (let i = 0; i < count; i++) {
    out.push(Math.pow(10, lmin + ((lmax - lmin) * i) / (count - 1)));
  }
  return out;
}

const PREAMP_PROBES = logFrequencies(160);

/**
 * Gain (dB, <= 0) applied before the bands so boosts can't push loud
 * masters into clipping: exactly cancels the curve's highest peak.
 */
export function autoPreampDb(bands: readonly number[], sampleRate = 48000): number {
  if (isFlat(bands)) return 0;
  let peak = 0;
  for (const f of PREAMP_PROBES) peak = Math.max(peak, responseDb(bands, f, sampleRate));
  return peak > 0 ? -peak : 0;
}

export function formatBandFrequency(freq: number): string {
  return freq >= 1000 ? `${freq / 1000}k` : String(freq);
}

export function formatDb(db: number): string {
  const v = Math.abs(db) < 0.05 ? 0 : db;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
}
