import type { LyricsTypography } from "./types";

export const LYRICS_TYPOGRAPHY: LyricsTypography = {
  family: "Montserrat, system-ui, sans-serif",
  size: 32,
  weight: 600,
  lineHeight: 44.8,
  paddingY: 20,
  paddingX: 8,
};

export const BACKGROUND_SCALE = 0.75;
export const SUBTITLE_SCALE = 0.8;
export const SUBTITLE_GAP = 8;

export function mainFont(type: LyricsTypography): string {
  return `${type.weight} ${type.size}px ${type.family}`;
}

export function backgroundFont(type: LyricsTypography): string {
  return `500 ${type.size * BACKGROUND_SCALE}px ${type.family}`;
}

export function subtitleFont(type: LyricsTypography): string {
  return `${type.weight} ${type.size * SUBTITLE_SCALE}px ${type.family}`;
}

export function resolveFamily(element: Element): string {
  const family = getComputedStyle(element)
    .getPropertyValue("--font-montserrat-family")
    .trim();
  return family ? `${family}, system-ui, sans-serif` : LYRICS_TYPOGRAPHY.family;
}

export async function loadLyricsFonts(
  type: LyricsTypography,
  text?: string,
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.allSettled([
    document.fonts.load(mainFont(type), text),
    document.fonts.load(backgroundFont(type), text),
    document.fonts.load(subtitleFont(type), text),
  ]);
}
