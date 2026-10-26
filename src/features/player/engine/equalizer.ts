// 10-band graphic equalizer: band layout, presets and helpers shared by the
// audio graph (pitchShifter) and the picker UI

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const EQ_BAND_Q = 1.4;
export const EQ_MAX_CUSTOM_PRESETS = 12;
export const EQ_PRESET_NAME_MAX = 24;

export const FLAT_EQ: number[] = EQ_BANDS.map(() => 0);

// enhance: improves the whole mix without pushing one aspect (gentle, < 3 dB moves)
// genre: tuned for a style of music
// accent: deliberately pushes one part of the spectrum
export type EqPresetCategory = "enhance" | "genre" | "accent";
export const EQ_PRESET_CATEGORIES: EqPresetCategory[] = [
  "enhance",
  "genre",
  "accent",
];

export interface EqPreset {
  id: string;
  category: EqPresetCategory;
  gains: number[];
}

export interface EqCustomPreset {
  id: string;
  name: string;
  gains: number[];
}

//                          32   64  125  250  500   1k   2k   4k   8k  16k
export const EQ_PRESETS: EqPreset[] = [
  // a subtle "smile": fuller lows and more air, mids untouched
  { id: "hifi", category: "enhance", gains: [2, 1.5, 0.5, 0, -0.5, 0, 0.5, 1.5, 2, 2.5] },
  // removes low-mid mud and adds presence: everything separates better
  { id: "clarity", category: "enhance", gains: [0, 0, -0.5, -1.5, -1, 0, 1.5, 2, 1.5, 1] },
  // analog-like warmth, tames harsh highs on bright / compressed masters
  { id: "warmth", category: "enhance", gains: [1.5, 2, 1.5, 0.5, 0, 0, -0.5, -1, -1, -1.5] },
  // wider-sounding stage: scooped center mids, open top
  { id: "spacious", category: "enhance", gains: [1, 1, 0, -1, -1.5, -1, 0, 1, 2, 2.5] },
  // compensates the usual headphone dip in sub bass and upper mids
  { id: "headphones", category: "enhance", gains: [2.5, 2, 1, 0, -0.5, 0, 1, 1.5, 0.5, -0.5] },
  // small speakers can't do sub bass: cut it, push the harmonics that imply it
  { id: "laptop", category: "enhance", gains: [-4, -1, 2, 2.5, 1, 0, 1, 1.5, 1, 0] },
  // quiet listening: less boom and sizzle, voices stay clear
  { id: "night", category: "enhance", gains: [-2, -1.5, -0.5, 0, 0.5, 1, 1, 0, -1, -2] },
  // tighter, punchier mix: kick and attack forward, boxy 500 Hz pulled back
  { id: "punch", category: "enhance", gains: [1, 2, 1.5, 0, -1.5, -0.5, 1, 1.5, 0.5, 0] },
  // long-session comfort: softens the 2-5 kHz harshness that causes fatigue
  { id: "smooth", category: "enhance", gains: [0.5, 0.5, 0.5, 0, 0, 0, -1, -2, -1, 0] },

  { id: "pop", category: "genre", gains: [-1, 0, 1.5, 2.5, 2, 0.5, -0.5, 0, 1, 1.5] },
  { id: "rock", category: "genre", gains: [3, 2.5, 1, -0.5, -1, -0.5, 1, 2, 2.5, 2.5] },
  { id: "hiphop", category: "genre", gains: [4, 3.5, 1.5, 0.5, -0.5, -0.5, 0.5, 0, 1, 1.5] },
  { id: "electronic", category: "genre", gains: [3.5, 3, 1, 0, -1.5, 0, 1, 1, 2.5, 3] },
  { id: "jazz", category: "genre", gains: [2, 1.5, 0.5, 1, -1, -1, 0, 1, 1.5, 2] },
  { id: "classical", category: "genre", gains: [2, 1.5, 1, 0.5, 0, 0, 0, 1, 1.5, 2] },
  { id: "acoustic", category: "genre", gains: [1.5, 1, 1, 1.5, 0.5, 0.5, 1, 1.5, 1, 0.5] },
  { id: "rnb", category: "genre", gains: [3, 3, 1.5, 0, -1, 0, 1, 1, 1.5, 2] },
  { id: "lofi", category: "genre", gains: [1, 1.5, 2, 1, 0, -0.5, -1.5, -2.5, -4, -6] },

  { id: "bass", category: "accent", gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { id: "deep_bass", category: "accent", gains: [9, 8, 5, 1, -1, 0, 0, 0, 0, 0] },
  { id: "less_bass", category: "accent", gains: [-6, -5, -3, -1, 0, 0, 0, 0, 0, 0] },
  { id: "vocal", category: "accent", gains: [-2, -2, -1, 0, 2, 4, 4, 2, 0, -1] },
  { id: "treble", category: "accent", gains: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6] },
  { id: "loudness", category: "accent", gains: [5, 4, 2, 0, -1, 0, 0, 2, 4, 5] },
];

export function normalizeEqGains(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EQ_BANDS.length) return FLAT_EQ;
  return value.map((gain) =>
    typeof gain === "number" && Number.isFinite(gain) ? clampEqGain(gain) : 0,
  );
}

export function normalizeEqCustomPresets(value: unknown): EqCustomPreset[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (preset): preset is EqCustomPreset =>
        Boolean(preset) &&
        typeof preset.id === "string" &&
        typeof preset.name === "string" &&
        preset.name.trim().length > 0,
    )
    .slice(0, EQ_MAX_CUSTOM_PRESETS)
    .map((preset) => ({
      id: preset.id,
      name: preset.name.trim().slice(0, EQ_PRESET_NAME_MAX),
      gains: normalizeEqGains(preset.gains),
    }));
}

export function clampEqGain(db: number): number {
  return Math.min(EQ_MAX_DB, Math.max(EQ_MIN_DB, Math.round(db * 2) / 2));
}

export function isEqFlat(gains: number[]): boolean {
  return gains.every((gain) => Math.abs(gain) < 0.01);
}

export function isEqActive(enabled: boolean, gains: number[]): boolean {
  return enabled && !isEqFlat(gains);
}

export function sameEqGains(a: number[], b: number[]): boolean {
  return a.every((gain, i) => Math.abs(gain - (b[i] ?? 0)) < 0.01);
}

export function findEqPreset(gains: number[]): EqPreset | null {
  return EQ_PRESETS.find((preset) => sameEqGains(preset.gains, gains)) ?? null;
}

export function findEqCustomPreset(
  presets: EqCustomPreset[],
  gains: number[],
): EqCustomPreset | null {
  return presets.find((preset) => sameEqGains(preset.gains, gains)) ?? null;
}

// boosts would clip a mastered track: pull the whole chain down by the loudest boost
export function eqPreampDb(gains: number[]): number {
  return -Math.max(0, ...gains);
}

export function formatEqFrequency(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz);
}
