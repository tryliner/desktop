import { useEffect, useState } from "react";
import {
  getCoverElement,
  preloadCoverArt,
} from "@/features/covers/lib/coverArt";
import {
  extractDarkDominantRgb,
  type DominantDarkColor,
} from "@/shared/lib/color";

export type { DominantDarkColor };

const colorCache = new Map<string, DominantDarkColor>();

export function useDominantDarkColor(
  imageUrl: string | undefined,
): DominantDarkColor | null {
  const [color, setColor] = useState<DominantDarkColor | null>(() => {
    if (!imageUrl) return null;
    return colorCache.get(imageUrl) ?? null;
  });

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
      return;
    }

    if (colorCache.has(imageUrl)) {
      setColor(colorCache.get(imageUrl)!);
      return;
    }

    let active = true;

    const processImage = (img: HTMLImageElement) => {
      const extracted = extractDarkDominantRgb(img);
      if (extracted && active) {
        const [r, g, b] = extracted;
        const result: DominantDarkColor = {
          r,
          g,
          b,
          rgb: `rgb(${r}, ${g}, ${b})`,
          rgba: (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`,
        };
        colorCache.set(imageUrl, result);
        setColor(result);
      }
    };

    const existingEl = getCoverElement(imageUrl);
    if (existingEl && existingEl.complete && existingEl.naturalWidth > 0) {
      processImage(existingEl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (active) processImage(img);
    };
    img.onerror = () => {
      void preloadCoverArt(imageUrl).then(() => {
        const fallbackEl = getCoverElement(imageUrl);
        if (
          active &&
          fallbackEl &&
          fallbackEl.complete &&
          fallbackEl.naturalWidth > 0
        ) {
          processImage(fallbackEl);
        }
      });
    };
    img.src = imageUrl;

    return () => {
      active = false;
    };
  }, [imageUrl]);

  return color;
}

export default useDominantDarkColor;
