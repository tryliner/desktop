export const BASE_COLUMN_WIDTH = 340;
const CONTROLS_HEIGHT = 260;
const MAX_COLUMN_SCALE = 1.6;

export function fullscreenColumnScale(width: number, height: number): number {
  const byWidth = (width * 0.32) / BASE_COLUMN_WIDTH;
  const byHeight = (height - 80 - CONTROLS_HEIGHT) / BASE_COLUMN_WIDTH;
  return Math.max(1, Math.min(byWidth, byHeight, MAX_COLUMN_SCALE));
}
