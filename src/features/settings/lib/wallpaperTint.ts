import { rgbToHsl, hslToRgb } from "@/shared/lib/color";
import { vividness, type ImageTone } from "@/shared/lib/imageTone";
import type { FluidColors } from "@/features/home/lib/extractFluidColors";

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

function parseRgb(value: string): [number, number, number] {
  const parts = value.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function wallpaperAccent({ color2 }: FluidColors, tone: ImageTone): string {
  const t = vividness(tone);
  const [h, s] = rgbToHsl(...parseRgb(color2));
  const [r, g, b] = hslToRgb(h, Math.min(1, s * lerp(0.15, 0.6, t)), lerp(0.06, 0.2, t));
  return `${r}, ${g}, ${b}`;
}

export function wallpaperFade(accent: string): string {
  return `linear-gradient(to bottom, rgba(${accent}, 0.2) 0%, rgba(${accent}, 0.5) 38%, rgba(${accent}, 0.94) 72%, rgb(${accent}) 100%)`;
}
