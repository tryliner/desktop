import { cubicBezier } from "./easing";
import type { InstrumentalState } from "./instrumentalTiming";

export const NOTE_PATH =
  "M10 21q-1.65 0-2.825-1.175T6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V4q0-.425.288-.712T13 3h4q.425 0 .713.288T18 4v2q0 .425-.288.713T17 7h-3v10q0 1.65-1.175 2.825T10 21";

export const NOTE_VIEWBOX = 24;
const WAVE_FLOOR = 4;
const WAVE_MID = 3;
const OSCILLATION_MS = 1250;
const WAVE_POINTS: [number, number, number][] = [
  [1, 5, -1],
  [10, 14, 1],
  [18, 22, -1],
  [26, 30, 1],
];

export const waveFlattenEasing = cubicBezier(0.42, 0, 1, 1);
const oscillationEasing = cubicBezier(0.42, 0, 0.58, 1);

let notePath: Path2D | null = null;

export function note(): Path2D {
  notePath ??= new Path2D(NOTE_PATH);
  return notePath;
}

function amplitude(phaseMs: number): number {
  const cycle =
    (((phaseMs % OSCILLATION_MS) + OSCILLATION_MS) % OSCILLATION_MS) /
    OSCILLATION_MS;
  const eased = oscillationEasing(cycle);
  const towardLow = eased < 0.5 ? eased * 2 : 2 - eased * 2;
  return 1 - 2 * towardLow;
}

export function waveClip(state: InstrumentalState): Path2D {
  const shift = state.shift * NOTE_VIEWBOX;
  const wave = amplitude(state.phaseMs);
  const y = (value: number) =>
    WAVE_FLOOR + (value - WAVE_FLOOR) * state.height + shift;
  const path = new Path2D();
  path.moveTo(-4, y(WAVE_MID));
  for (const [control, end, direction] of WAVE_POINTS) {
    path.quadraticCurveTo(
      control,
      y(WAVE_MID + direction * wave),
      end,
      y(WAVE_MID),
    );
  }
  path.lineTo(30, 30 + shift);
  path.lineTo(-4, 30 + shift);
  path.closePath();
  path.rect(-4, 3.9 + shift, 34, 30);
  return path;
}
