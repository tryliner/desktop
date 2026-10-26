import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import likesCover from "@/assets/likes-cover.svg";
import {
  useCustomizationStore,
  useHasCustomBackground,
} from "@/features/settings/store/customizationStore";
import { extractColorsFromImage } from "@/features/home/lib/extractFluidColors";
import {
  buildLikesCoverSvg,
  buildLightLikesCoverSvg,
  measureImageTone,
  svgToDataUrl,
} from "../lib/likesCoverPalette";

let cachedWallpaper: string | null = null;
let cachedCover: string | null = null;
let lightCover: string | null = null;

function getLightCover(): string {
  lightCover ??= svgToDataUrl(buildLightLikesCoverSvg());
  return lightCover;
}

export function useLikesCover(): string {
  const wallpaper = useCustomizationStore((s) => s.backgroundImage);
  const hasCustomBg = useHasCustomBackground();
  const { resolvedTheme } = useTheme();
  const [cover, setCover] = useState<string | null>(() =>
    wallpaper && wallpaper === cachedWallpaper ? cachedCover : null,
  );

  useEffect(() => {
    if (!wallpaper || !hasCustomBg) {
      setCover(null);
      return;
    }
    if (wallpaper === cachedWallpaper && cachedCover) {
      setCover(cachedCover);
      return;
    }

    let active = true;
    const img = new Image();
    img.onload = () => {
      if (!active) return;
      const tinted = svgToDataUrl(
        buildLikesCoverSvg(extractColorsFromImage(img), measureImageTone(img)),
      );
      cachedWallpaper = wallpaper;
      cachedCover = tinted;
      setCover(tinted);
    };
    img.onerror = () => {
      if (active) setCover(null);
    };
    img.src = wallpaper;

    return () => {
      active = false;
    };
  }, [wallpaper, hasCustomBg]);

  if (hasCustomBg && cover) return cover;
  if (resolvedTheme === "light") return getLightCover();
  return likesCover;
}
