export const VOLUME_STEP_OPTIONS = [0.01, 0.02, 0.05, 0.1] as const;
export type VolumeStep = (typeof VOLUME_STEP_OPTIONS)[number];
export const DEFAULT_VOLUME_STEP: VolumeStep = 0.05;

export function isVolumeStep(value: unknown): value is VolumeStep {
  return (VOLUME_STEP_OPTIONS as readonly unknown[]).includes(value);
}

export function stepVolumeLevel(
  level: number,
  direction: 1 | -1,
  step: number,
): number {
  const next = Math.min(1, Math.max(0, level + direction * step));
  return Math.round(next * 100) / 100;
}
