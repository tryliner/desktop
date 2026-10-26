export interface DominantDarkColor {
  r: number;
  g: number;
  b: number;
  rgb: string;
  rgba: (alpha: number) => string;
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const normR = r / 255;
  const normG = g / 255;
  const normB = b / 255;
  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case normR:
        h = (normG - normB) / d + (normG < normB ? 6 : 0);
        break;
      case normG:
        h = (normB - normR) / d + 2;
        break;
      case normB:
        h = (normR - normG) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let corrected = t;
    if (corrected < 0) corrected += 1;
    if (corrected > 1) corrected -= 1;
    if (corrected < 1 / 6) return p + (q - p) * 6 * corrected;
    if (corrected < 1 / 2) return q;
    if (corrected < 2 / 3) return p + (q - p) * (2 / 3 - corrected) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function extractDarkDominantRgb(
  img: HTMLImageElement,
): [number, number, number] | null {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const size = 32;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size).data;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    let bestColor = { r: 35, g: 35, b: 42 };
    let bestScore = -1;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];

      if (a < 128) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 15 || lum > 240) continue;

      const score = diff * (1 - Math.abs(lum - 128) / 140);
      if (score > bestScore) {
        bestScore = score;
        bestColor = { r, g, b };
      }

      rSum += r;
      gSum += g;
      bSum += b;
      count++;
    }

    if (bestScore <= 8 && count > 0) {
      bestColor = {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
      };
    }

    const [h, s] = rgbToHsl(bestColor.r, bestColor.g, bestColor.b);
    const tunedS = Math.min(Math.max(s * 1.15, 0.4), 0.85);
    const tunedL = 0.17;

    return hslToRgb(h, tunedS, tunedL);
  } catch {
    return null;
  }
}
