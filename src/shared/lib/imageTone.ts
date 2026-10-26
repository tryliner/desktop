import { rgbToHsl } from "./color";

export interface ImageTone {
  luminance: number;
  colorfulness: number;
  hue?: number;
}

export const DARK_TONE: ImageTone = { luminance: 0, colorfulness: 0 };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function toneFromPixels(data: ArrayLike<number>): ImageTone {
  let luma = 0;
  let sat = 0;
  let pixels = 0;
  let saturatedPixels = 0;
  let hueX = 0;
  let hueY = 0;

  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    pixels++;
    luma += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const [, s, l] = rgbToHsl(r, g, b);
    if (l > 0.1 && l < 0.9) {
      sat += s;
      saturatedPixels++;
      const [h] = rgbToHsl(r, g, b);
      hueX += Math.cos(h * Math.PI * 2) * s;
      hueY += Math.sin(h * Math.PI * 2) * s;
    }
  }

  if (pixels === 0) return DARK_TONE;
  const hasHue = Math.abs(hueX) + Math.abs(hueY) > 1e-6;
  return {
    luminance: luma / pixels,
    colorfulness: saturatedPixels ? (sat / saturatedPixels) * (saturatedPixels / pixels) : 0,
    hue: hasHue ? (Math.atan2(hueY, hueX) / (Math.PI * 2) + 1) % 1 : undefined,
  };
}

export function measureImageTone(img: HTMLImageElement): ImageTone {
  try {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return DARK_TONE;
    ctx.drawImage(img, 0, 0, size, size);
    return toneFromPixels(ctx.getImageData(0, 0, size, size).data);
  } catch {
    return DARK_TONE;
  }
}

export function vividness({ luminance, colorfulness }: ImageTone): number {
  const brightness = clamp01((luminance - 0.18) / 0.3);
  const color = clamp01(colorfulness / 0.4);
  return brightness * (0.35 + 0.65 * color);
}

export function hueRarity(hue: number | undefined): number {
  if (hue === undefined) return 1;
  if (hue >= 0.75 && hue < 0.97) return 1.4;
  if (hue >= 0.5 && hue < 0.75) return 1.15;
  if (hue >= 0.97 || hue < 0.03) return 1;
  if (hue >= 0.25 && hue < 0.5) return 0.95;
  if (hue >= 0.17 && hue < 0.25) return 0.75;
  return 0.55;
}

export function strikingness({ luminance, colorfulness, hue }: ImageTone): number {
  const color = (colorfulness * hueRarity(hue)) / 0.4;
  const darkness = clamp01((0.25 - luminance) / 0.2) * 0.9;
  return Math.max(color, darkness);
}

export function pickStrikingIndex(tones: (ImageTone | undefined)[]): number {
  let best = 0;
  let bestScore = -1;
  tones.forEach((tone, index) => {
    if (!tone) return;
    const score = strikingness(tone);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}
