import { hslToRgb, rgbToHsl } from "@/shared/lib/color";

/**
 * Colour themes on top of the light/dark palettes in globals.css. A preset
 * only overrides the variables it cares about, for one or both modes; the
 * light/dark switch (next-themes) keeps working underneath.
 */

export type PresetId =
  "default" | "oled" | "midnight" | "nord" | "rose" | "forest" | "sunset";

export type ThemeVars = Partial<Record<`--${string}`, string>>;

export interface ThemePreset {
  id: PresetId;
  /** swatches for the picker: [background, surface, accent] */
  swatch: [string, string, string];
  dark?: ThemeVars;
  light?: ThemeVars;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "default", swatch: ["#0a0a0a", "#1a1a1a", "#ff4d4d"] },
  {
    id: "oled",
    swatch: ["#000000", "#0d0d0d", "#ffffff"],
    dark: {
      "--bg-canvas": "#000000",
      "--bg-surface": "#000000",
      "--bg-primary": "#000000",
      "--bg-elevated": "#0d0d0d",
      "--bg-panel": "#111111",
      "--bg-overlay": "rgba(0, 0, 0, 0.96)",
      "--bg-glass": "rgba(0, 0, 0, 0.55)",
      "--surface-glass": "rgba(0, 0, 0, 0.92)",
      "--border-primary": "#111111",
    },
  },
  {
    id: "midnight",
    swatch: ["#070b16", "#131b30", "#6c8cff"],
    dark: {
      "--bg-canvas": "#070b16",
      "--bg-surface": "#0c1222",
      "--bg-primary": "#0c1222",
      "--bg-elevated": "#131b30",
      "--bg-panel": "#18223a",
      "--bg-overlay": "rgba(12, 18, 34, 0.96)",
      "--bg-glass": "rgba(40, 60, 110, 0.2)",
      "--surface-glass": "rgba(16, 24, 44, 0.92)",
      "--border-primary": "#18223a",
      "--accent-primary": "#6c8cff",
      "--accent-secondary": "#8fa7ff",
      "--accent-tertiary": "#a9bbff",
    },
    light: {
      "--bg-canvas": "#dfe4f2",
      "--bg-primary": "#f3f5fb",
      "--bg-elevated": "#e2e7f3",
      "--bg-panel": "#d9dfee",
      "--accent-primary": "#3d5afe",
      "--accent-secondary": "#5c74ff",
      "--accent-tertiary": "#7b8eff",
    },
  },
  {
    id: "nord",
    swatch: ["#2e3440", "#3b4252", "#88c0d0"],
    dark: {
      "--bg-canvas": "#242933",
      "--bg-surface": "#2e3440",
      "--bg-primary": "#2e3440",
      "--bg-elevated": "#3b4252",
      "--bg-panel": "#434c5e",
      "--bg-overlay": "rgba(46, 52, 64, 0.96)",
      "--bg-glass": "rgba(76, 86, 106, 0.3)",
      "--surface-glass": "rgba(46, 52, 64, 0.92)",
      "--border-primary": "#3b4252",
      "--text-primary": "#eceff4",
      "--accent-primary": "#88c0d0",
      "--accent-secondary": "#8fbcbb",
      "--accent-tertiary": "#a3d0dc",
    },
    light: {
      "--bg-canvas": "#d8dee9",
      "--bg-primary": "#eceff4",
      "--bg-elevated": "#e5e9f0",
      "--bg-panel": "#d8dee9",
      "--text-primary": "#2e3440",
      "--accent-primary": "#5e81ac",
      "--accent-secondary": "#81a1c1",
      "--accent-tertiary": "#88c0d0",
    },
  },
  {
    id: "rose",
    swatch: ["#140c10", "#26171e", "#ff6b9a"],
    dark: {
      "--bg-canvas": "#140c10",
      "--bg-surface": "#1c1116",
      "--bg-primary": "#1c1116",
      "--bg-elevated": "#26171e",
      "--bg-panel": "#2d1b24",
      "--bg-overlay": "rgba(28, 17, 22, 0.96)",
      "--bg-glass": "rgba(110, 40, 70, 0.18)",
      "--surface-glass": "rgba(32, 18, 25, 0.92)",
      "--border-primary": "#2d1b24",
      "--accent-primary": "#ff6b9a",
      "--accent-secondary": "#ff8fb2",
      "--accent-tertiary": "#ffabc5",
    },
    light: {
      "--bg-canvas": "#f0e0e6",
      "--bg-primary": "#fbf3f5",
      "--bg-elevated": "#f0e2e7",
      "--bg-panel": "#ead7dd",
      "--accent-primary": "#d6336c",
      "--accent-secondary": "#e64980",
      "--accent-tertiary": "#f06595",
    },
  },
  {
    id: "forest",
    swatch: ["#08110c", "#15231a", "#4ade80"],
    dark: {
      "--bg-canvas": "#08110c",
      "--bg-surface": "#0e1912",
      "--bg-primary": "#0e1912",
      "--bg-elevated": "#15231a",
      "--bg-panel": "#1a2b20",
      "--bg-overlay": "rgba(14, 25, 18, 0.96)",
      "--bg-glass": "rgba(40, 100, 60, 0.18)",
      "--surface-glass": "rgba(14, 27, 19, 0.92)",
      "--border-primary": "#1a2b20",
      "--accent-primary": "#4ade80",
      "--accent-secondary": "#6ee7a0",
      "--accent-tertiary": "#86efac",
    },
    light: {
      "--bg-canvas": "#dde8df",
      "--bg-primary": "#f2f7f3",
      "--bg-elevated": "#e1ebe3",
      "--bg-panel": "#d6e3d9",
      "--accent-primary": "#16a34a",
      "--accent-secondary": "#22c55e",
      "--accent-tertiary": "#4ade80",
    },
  },
  {
    id: "sunset",
    swatch: ["#130d08", "#261a10", "#ff9f43"],
    dark: {
      "--bg-canvas": "#130d08",
      "--bg-surface": "#1b130c",
      "--bg-primary": "#1b130c",
      "--bg-elevated": "#261a10",
      "--bg-panel": "#2e2014",
      "--bg-overlay": "rgba(27, 19, 12, 0.96)",
      "--bg-glass": "rgba(120, 70, 30, 0.18)",
      "--surface-glass": "rgba(30, 21, 13, 0.92)",
      "--border-primary": "#2e2014",
      "--accent-primary": "#ff9f43",
      "--accent-secondary": "#ffb46b",
      "--accent-tertiary": "#ffc78f",
    },
    light: {
      "--bg-canvas": "#f1e4d8",
      "--bg-primary": "#fbf5ef",
      "--bg-elevated": "#f1e6da",
      "--bg-panel": "#eadacb",
      "--accent-primary": "#ea580c",
      "--accent-secondary": "#f97316",
      "--accent-tertiary": "#fb923c",
    },
  },
];

export const PRESET_IDS = THEME_PRESETS.map((preset) => preset.id);

export function presetById(id: string): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is `#${string}` {
  return typeof value === "string" && HEX.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * one picked colour -> the three accent shades the app uses, adjusted so the
 * accent stays visible on the current background
 */
export function accentVars(hex: string, isDark: boolean): ThemeVars {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  // too dark on dark (or too pale on light) would vanish against surfaces
  const base = isDark ? Math.max(l, 0.55) : Math.min(l, 0.5);
  const shade = (delta: number) =>
    rgbToHex(hslToRgb(h, s, Math.min(0.92, Math.max(0.08, base + delta))));
  return {
    "--accent-primary": shade(0),
    "--accent-secondary": shade(isDark ? 0.1 : 0.08),
    "--accent-tertiary": shade(isDark ? 0.18 : 0.15),
  };
}

/** "rgb(12, 34, 56)" -> "#0c2238" */
export function rgbStringToHex(value: string): string | null {
  const parts = value.match(/\d+(\.\d+)?/g)?.map(Number);
  if (!parts || parts.length < 3) return null;
  return rgbToHex(
    [parts[0], parts[1], parts[2]].map((v) =>
      Math.max(0, Math.min(255, Math.round(v))),
    ) as [number, number, number],
  );
}

function block(selector: string, vars: ThemeVars): string {
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return body ? `${selector} {\n${body}\n}` : "";
}

// a notch more specific than globals.css (:root[data-theme]) so we always win
const DARK = 'html:root[data-theme="dark"], html:root.dark';
const LIGHT = 'html:root[data-theme="light"], html:root.light';

export function themeCss(vars: { dark: ThemeVars; light: ThemeVars }): string {
  return [block(DARK, vars.dark), block(LIGHT, vars.light)]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * How much darkening (dark theme) or lightening (light theme) a wallpaper
 * needs so text on it stays readable, from the image's average luminance.
 * White text wants the backdrop at or under ~0.16 luminance (5:1 against
 * white); dark text wants it at or over ~0.6. Returns 0..0.85, the same scale as the dim slider.
 */
export function readableDim(luminance: number, isDark: boolean): number {
  const l = Math.min(1, Math.max(0, luminance));
  const needed = isDark
    ? l <= 0.16
      ? 0
      : 1 - 0.16 / l
    : l >= 0.6
      ? 0
      : (0.6 - l) / (1 - l);
  return Math.min(0.85, Math.max(0, needed));
}

/** frosted surfaces over a wallpaper: tint colour by mode, strength 0..1 */
export function glassVars(
  opacity: number,
  blurPx: number,
  isDark: boolean,
): ThemeVars {
  const alpha = Math.min(0.9, Math.max(0, opacity)).toFixed(2);
  return {
    "--bg-glass": isDark
      ? `rgba(18, 18, 20, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`,
    "--glass-blur": `${Math.round(blurPx)}px`,
  };
}
