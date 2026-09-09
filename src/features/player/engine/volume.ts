const VOLUME_CURVE = 2;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// maps linear web audio gain to perceptual slider curve
export function toVolumeLevel(gain: number): number {
  return Math.pow(clamp(gain), 1 / VOLUME_CURVE);
}

// converts ui slider curve back to linear gain
export function toVolumeGain(level: number): number {
  return Math.pow(clamp(level), VOLUME_CURVE);
}
