import likesCoverSvg from "@/assets/likes-cover.svg?raw";
import { rgbToHsl, hslToRgb } from "@/shared/lib/color";
import type { FluidColors } from "@/features/home/lib/extractFluidColors";
import { DARK_TONE, vividness, type ImageTone } from "@/shared/lib/imageTone";

export {
  DARK_TONE,
  measureImageTone,
  toneFromPixels,
  vividness,
  type ImageTone,
} from "@/shared/lib/imageTone";

const STOP_INNER = "#111224";
const STOP_OUTER = "#433277";
const GLOW_BOTTOM = "#4D71FF";
const GLOW_TOP = "#7A4DFF";
const GLOW_LEFT = "#534DFF";
const SHADE = 'fill="black" fill-opacity="0.2"';

function parseRgb(value: string): [number, number, number] {
  const parts = value.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function toHex(h: number, s: number, l: number): string {
  const wrapped = ((h % 1) + 1) % 1;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return `#${hslToRgb(wrapped, clamp(s), clamp(l))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export function buildLikesCoverSvg(
  colors: FluidColors,
  tone: ImageTone = DARK_TONE,
): string {
  return tintLikesCoverSvg(colors, vividness(tone));
}

function tintLikesCoverSvg({ color1, color2 }: FluidColors, t: number): string {
  const [h1, s1] = rgbToHsl(...parseRgb(color1));
  const [h2, s2] = rgbToHsl(...parseRgb(color2));
  const shade = lerp(0.45, 0.12, t).toFixed(2);

  return likesCoverSvg
    .replace(SHADE, `fill="black" fill-opacity="${shade}"`)
    .replaceAll(STOP_INNER, toHex(h2, s2 * lerp(0.4, 0.85, t), lerp(0.03, 0.2, t)))
    .replaceAll(STOP_OUTER, toHex(h2, s2 * lerp(0.6, 0.95, t), lerp(0.16, 0.42, t)))
    .replaceAll(GLOW_BOTTOM, toHex(h2, s2 * lerp(0.8, 1, t), lerp(0.42, 0.58, t)))
    .replaceAll(GLOW_TOP, toHex(h2 + 0.06, s2 * lerp(0.8, 1, t), lerp(0.4, 0.62, t)))
    .replaceAll(GLOW_LEFT, toHex(h1, Math.max(s1, 0.4), lerp(0.36, 0.5, t)));
}

const STOCK_COLORS: FluidColors = {
  color1: "rgb(83, 77, 255)",
  color2: "rgb(122, 77, 255)",
  logoColor: "rgb(255, 255, 255)",
};
const HEART = 'fill="white" fill-opacity="0.7"';
const LIGHT_SHADE = 'fill="white" fill-opacity="0.15"';
const LIGHT_HEART = 'fill="white" fill-opacity="0.92"';

export function buildLightLikesCoverSvg({ color1, color2 }: FluidColors = STOCK_COLORS): string {
  const [h1, s1] = rgbToHsl(...parseRgb(color1));
  const [h2, s2] = rgbToHsl(...parseRgb(color2));

  return likesCoverSvg
    .replace(SHADE, LIGHT_SHADE)
    .replace(HEART, LIGHT_HEART)
    .replaceAll(STOP_INNER, toHex(h1, s1 * 0.55, 0.84))
    .replaceAll(STOP_OUTER, toHex(h2, s2 * 0.6, 0.7))
    .replaceAll(GLOW_BOTTOM, toHex(h2, s2 * 0.9, 0.62))
    .replaceAll(GLOW_TOP, toHex(h2 + 0.06, s2 * 0.9, 0.66))
    .replaceAll(GLOW_LEFT, toHex(h1, Math.max(s1, 0.5), 0.6));
}

const STOCK_PALETTE = [STOP_INNER, STOP_OUTER, GLOW_BOTTOM, GLOW_TOP, GLOW_LEFT];
const STOCK_REFERENCE_HUE = rgbToHsl(...hexToRgb(GLOW_LEFT))[0];
const FULL_COLOUR_SATURATION = 0.45;

function hexToRgb(value: string): [number, number, number] {
  const n = parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildAccentBackdropSvg({ color2 }: FluidColors): string {
  const [accentHue, accentSaturation] = rgbToHsl(...parseRgb(color2));
  const shift = accentHue - STOCK_REFERENCE_HUE;
  const saturationScale = Math.min(1, accentSaturation / FULL_COLOUR_SATURATION);
  return STOCK_PALETTE.reduce((svg, stock) => {
    const [h, sat, l] = rgbToHsl(...hexToRgb(stock));
    return svg.replaceAll(stock, toHex(h + shift, sat * saturationScale, l));
  }, likesCoverSvg);
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
