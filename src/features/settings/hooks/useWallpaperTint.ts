import { useEffect, useState } from "react";
import { extractColorsFromImage } from "@/features/home/lib/extractFluidColors";
import { measureImageTone } from "@/shared/lib/imageTone";
import { useCustomizationStore } from "../store/customizationStore";
import { wallpaperAccent, wallpaperFade } from "../lib/wallpaperTint";

let cachedWallpaper: string | null = null;
let cachedFade: string | null = null;

export function useWallpaperFade(): string | null {
  const wallpaper = useCustomizationStore((s) => s.backgroundImage);
  const [fade, setFade] = useState<string | null>(() =>
    wallpaper && wallpaper === cachedWallpaper ? cachedFade : null,
  );

  useEffect(() => {
    if (!wallpaper) {
      setFade(null);
      return;
    }
    if (wallpaper === cachedWallpaper && cachedFade) {
      setFade(cachedFade);
      return;
    }

    let active = true;
    const img = new Image();
    img.onload = () => {
      if (!active) return;
      const next = wallpaperFade(wallpaperAccent(extractColorsFromImage(img), measureImageTone(img)));
      cachedWallpaper = wallpaper;
      cachedFade = next;
      setFade(next);
    };
    img.onerror = () => {
      if (active) setFade(null);
    };
    img.src = wallpaper;

    return () => {
      active = false;
    };
  }, [wallpaper]);

  return wallpaper ? fade : null;
}
