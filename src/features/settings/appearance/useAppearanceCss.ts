import { useEffect, useState } from "react";
import { extractColorsFromImage } from "@/features/home/lib/extractFluidColors";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { useAppearanceStore } from "./appearanceStore";
import { importLegacyWallpaper } from "./legacyWallpaper";
import {
  accentVars,
  glassVars,
  presetById,
  rgbStringToHex,
  themeCss,
  type ThemeVars,
} from "./themePresets";

const STYLE_ID = "liner-appearance";

/** the playing song's cover colour, for "match current song" accents */
function useCoverAccent(enabled: boolean): string | null {
  const cover = usePlayerStore((s) => s.currentTrack?.coverUrl ?? null);
  const [hex, setHex] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !cover) {
      setHex(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!active) return;
      try {
        setHex(rgbStringToHex(extractColorsFromImage(img).color2));
      } catch {
        setHex(null);
      }
    };
    img.src = cover;
    return () => {
      active = false;
    };
  }, [enabled, cover]);
  return hex;
}

/**
 * Writes the chosen theme into one <style> tag: preset colours for each
 * mode, the accent, and the frosted-panel tint while a wallpaper is on.
 */
export function useAppearanceCss() {
  const preset = useAppearanceStore((s) => s.preset);
  const accent = useAppearanceStore((s) => s.accent);
  const hasWallpaper = useAppearanceStore((s) => Boolean(s.wallpaperKey));
  const surfaceOpacity = useAppearanceStore((s) => s.surfaceOpacity);
  const coverHex = useCoverAccent(accent === "cover");

  useEffect(() => {
    const theme = presetById(preset);
    const accentHex =
      accent === "cover" ? coverHex : accent !== "default" ? accent : null;
    const forMode = (isDark: boolean): ThemeVars => ({
      ...(isDark ? theme.dark : theme.light),
      ...(accentHex ? accentVars(accentHex, isDark) : {}),
      ...(hasWallpaper ? glassVars(surfaceOpacity, 28, isDark) : {}),
    });
    const css = themeCss({ dark: forMode(true), light: forMode(false) });

    let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!css) {
      tag?.remove();
      return;
    }
    if (!tag) {
      tag = document.createElement("style");
      tag.id = STYLE_ID;
      document.head.appendChild(tag);
    }
    if (tag.textContent !== css) tag.textContent = css;
    document.documentElement.toggleAttribute("data-wallpaper", hasWallpaper);
  }, [preset, accent, coverHex, hasWallpaper, surfaceOpacity]);

  useEffect(() => {
    void importLegacyWallpaper();
  }, []);

  useEffect(
    () => () => {
      document.getElementById(STYLE_ID)?.remove();
      document.documentElement.removeAttribute("data-wallpaper");
    },
    [],
  );
}
