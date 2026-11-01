// DSP Audio processing helpers: Loudness Normalization and Bauer Spatial Crossfeed

export interface NormalizerConfig {
  threshold: number; // dB
  knee: number; // dB
  ratio: number;
  attack: number; // seconds
  release: number; // seconds
}

export const EBU_R128_NORMALIZER: NormalizerConfig = {
  threshold: -18.0,
  knee: 24.0,
  ratio: 4.0,
  attack: 0.005,
  release: 0.150,
};

export type CrossfeedMode = "off" | "subtle" | "standard" | "wide";

export interface CrossfeedConfig {
  delaySeconds: number;
  cutoffHz: number;
  crossGainDb: number;
  surroundDelaySeconds: number;
  surroundGainDb: number;
  elevationGainDb: number;
  spatialRoomWet: number;
}

export const CROSSFEED_PRESETS: Record<
  Exclude<CrossfeedMode, "off">,
  CrossfeedConfig
> = {
  subtle: {
    delaySeconds: 0.0003,
    cutoffHz: 800,
    crossGainDb: -6.0,
    surroundDelaySeconds: 0.012,
    surroundGainDb: -14.0,
    elevationGainDb: 1.2,
    spatialRoomWet: 0.08,
  },
  standard: {
    delaySeconds: 0.0004,
    cutoffHz: 700,
    crossGainDb: -4.5,
    surroundDelaySeconds: 0.016,
    surroundGainDb: -9.5,
    elevationGainDb: 2.5,
    spatialRoomWet: 0.18,
  },
  wide: {
    delaySeconds: 0.0005,
    cutoffHz: 650,
    crossGainDb: -3.5,
    surroundDelaySeconds: 0.022,
    surroundGainDb: -7.0,
    elevationGainDb: 3.5,
    spatialRoomWet: 0.28,
  },
};

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

export function isCrossfeedActive(mode: CrossfeedMode): boolean {
  return mode !== "off" && mode in CROSSFEED_PRESETS;
}
