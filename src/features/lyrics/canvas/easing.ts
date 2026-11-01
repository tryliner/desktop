export type Easing = (progress: number) => number;

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Easing {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const error = sampleX(t) - x;
      const slope = slopeX(t);
      if (Math.abs(error) < 1e-5 || Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    if (t >= 0 && t <= 1 && Math.abs(sampleX(t) - x) < 1e-4) return t;
    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      if (sampleX(t) < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (progress) => {
    const x = clamp01(progress);
    if (x === 0 || x === 1) return x;
    return sampleY(solve(x));
  };
}

export const scrollEasing = cubicBezier(0.86, 0, 0.2, 1);
export const fogEasing = cubicBezier(0.22, 1, 0.36, 1);

export const cssEase = cubicBezier(0.25, 0.1, 0.25, 1);
