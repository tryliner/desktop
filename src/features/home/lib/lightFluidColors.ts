import { rgbToHsl, hslToRgb } from "@/shared/lib/color";

function parseRgb(value: string): [number, number, number] {
  const parts = value.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function withLightness(color: string, lightness: number): string {
  const [h, s] = rgbToHsl(...parseRgb(color));
  const [r, g, b] = hslToRgb(h, Math.min(s, 0.7), lightness);
  return `rgb(${r}, ${g}, ${b})`;
}
