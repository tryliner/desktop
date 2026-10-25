export const EQUALIZER_BANDS = [
  { id: "32", frequency: 32, label: "32 Hz" },
  { id: "64", frequency: 64, label: "64 Hz" },
  { id: "125", frequency: 125, label: "125 Hz" },
  { id: "250", frequency: 250, label: "250 Hz" },
  { id: "500", frequency: 500, label: "500 Hz" },
  { id: "1k", frequency: 1000, label: "1 kHz" },
  { id: "2k", frequency: 2000, label: "2 kHz" },
  { id: "4k", frequency: 4000, label: "4 kHz" },
  { id: "8k", frequency: 8000, label: "8 kHz" },
  { id: "16k", frequency: 16000, label: "16 kHz" },
] as const;

export type EqualizerBand = (typeof EQUALIZER_BANDS)[number]["id"];
export type EnhancementEngine = "hqmusic-3" | "glyphs-7B" | "fyro1.1";
export type EnhancementPreset = "studio" | "vinyl" | "concert" | "custom";

export interface AudioSettings {
  isEqualizerEnabled: boolean;
  equalizerBands: number[];
  isEnhancerEnabled: boolean;
  enhancementEngine: EnhancementEngine;
  enhancementPreset: EnhancementPreset;
  vocalClarity: number;
  highEndAir: number;
  bassDepth: number;
}

export type AudioSettingsInput = Partial<AudioSettings> & {
  equalizerLow?: unknown;
  equalizerMid?: unknown;
  equalizerHigh?: unknown;
};

export const EQUALIZER_GAIN_LIMIT = 12;
export const ENHANCEMENT_PARAMETER_MIN = -50;
export const ENHANCEMENT_PARAMETER_MAX = 50;

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  isEqualizerEnabled: false,
  equalizerBands: EQUALIZER_BANDS.map(() => 0),
  isEnhancerEnabled: false,
  enhancementEngine: "hqmusic-3",
  enhancementPreset: "studio",
  vocalClarity: 0,
  highEndAir: 0,
  bassDepth: 0,
};

const EQUALIZER_INDEX = Object.fromEntries(
  EQUALIZER_BANDS.map((band, index) => [band.id, index]),
) as Record<EqualizerBand, number>;

const LEGACY_EQUALIZER_INDEX = {
  low: EQUALIZER_INDEX["250"],
  mid: EQUALIZER_INDEX["1k"],
  high: EQUALIZER_INDEX["4k"],
} as const;

const ENHANCEMENT_ENGINES: EnhancementEngine[] = [
  "hqmusic-3",
  "glyphs-7B",
  "fyro1.1",
];
const ENHANCEMENT_PRESETS: EnhancementPreset[] = [
  "studio",
  "vinyl",
  "concert",
  "custom",
];

export function clampAudioValue(
  value: unknown,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : 0;
}

// Used at both persistence and DSP boundaries so malformed values never reach AudioParams.
export function sanitizeAudioSettings(
  settings: AudioSettingsInput,
): AudioSettings {
  const legacyBands = Array(EQUALIZER_BANDS.length).fill(0) as number[];
  let gains = settings.equalizerBands;

  // Convert values written by the earlier three-band build during rehydration.
  const hasLegacyBands =
    settings.equalizerLow !== undefined ||
    settings.equalizerMid !== undefined ||
    settings.equalizerHigh !== undefined;
  if (!Array.isArray(gains) || hasLegacyBands) {
    legacyBands[LEGACY_EQUALIZER_INDEX.low] = clampAudioValue(
      settings.equalizerLow,
      -EQUALIZER_GAIN_LIMIT,
      EQUALIZER_GAIN_LIMIT,
    );
    legacyBands[LEGACY_EQUALIZER_INDEX.mid] = clampAudioValue(
      settings.equalizerMid,
      -EQUALIZER_GAIN_LIMIT,
      EQUALIZER_GAIN_LIMIT,
    );
    legacyBands[LEGACY_EQUALIZER_INDEX.high] = clampAudioValue(
      settings.equalizerHigh,
      -EQUALIZER_GAIN_LIMIT,
      EQUALIZER_GAIN_LIMIT,
    );
    gains = legacyBands;
  }

  const normalizedEngine = ENHANCEMENT_ENGINES.includes(
    settings.enhancementEngine as EnhancementEngine,
  )
    ? (settings.enhancementEngine as EnhancementEngine)
    : DEFAULT_AUDIO_SETTINGS.enhancementEngine;
  const normalizedPreset = ENHANCEMENT_PRESETS.includes(
    settings.enhancementPreset as EnhancementPreset,
  )
    ? (settings.enhancementPreset as EnhancementPreset)
    : DEFAULT_AUDIO_SETTINGS.enhancementPreset;

  return {
    isEqualizerEnabled: settings.isEqualizerEnabled === true,
    equalizerBands: EQUALIZER_BANDS.map((_, index) =>
      clampAudioValue(
        gains[index],
        -EQUALIZER_GAIN_LIMIT,
        EQUALIZER_GAIN_LIMIT,
      ),
    ),
    isEnhancerEnabled: settings.isEnhancerEnabled === true,
    enhancementEngine: normalizedEngine,
    enhancementPreset: normalizedPreset,
    vocalClarity: clampAudioValue(
      settings.vocalClarity,
      ENHANCEMENT_PARAMETER_MIN,
      ENHANCEMENT_PARAMETER_MAX,
    ),
    highEndAir: clampAudioValue(
      settings.highEndAir,
      ENHANCEMENT_PARAMETER_MIN,
      ENHANCEMENT_PARAMETER_MAX,
    ),
    bassDepth: clampAudioValue(
      settings.bassDepth,
      ENHANCEMENT_PARAMETER_MIN,
      ENHANCEMENT_PARAMETER_MAX,
    ),
  };
}

export function getEqualizerBandIndex(band: EqualizerBand): number {
  return EQUALIZER_INDEX[band];
}
