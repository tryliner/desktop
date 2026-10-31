export const DISQUALIFY_DELTA_MS = 15_000;

export function durationDelta(
  left?: number | null,
  right?: number | null,
): number | undefined {
  return left && right ? Math.abs(left - right) : undefined;
}

export function durationScore(delta: number | undefined): number {
  if (delta === undefined) return 10;
  if (delta <= 3_000) return 30;
  if (delta <= 5_000) return 22;
  if (delta <= 8_000) return 12;
  if (delta <= 12_000) return 2;
  if (delta <= DISQUALIFY_DELTA_MS) return -20;
  return -100;
}
