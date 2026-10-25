import { useEffect, useState } from "react";
import {
  getCoverElement,
  preloadCoverArt,
} from "@/features/covers/lib/coverArt";
import {
  extractColorsFromImage,
  DEFAULT_FLUID_COLORS,
  type FluidColors,
} from "../lib/extractFluidColors";

export type { FluidColors };

const fluidColorCache = new Map<string, FluidColors>();

export function useCoverFluidColors(imageUrl: string | undefined): FluidColors {
  const [colors, setColors] = useState<FluidColors>(() => {
    if (!imageUrl) return DEFAULT_FLUID_COLORS;
    return fluidColorCache.get(imageUrl) ?? DEFAULT_FLUID_COLORS;
  });

  useEffect(() => {
    if (!imageUrl) {
      setColors(DEFAULT_FLUID_COLORS);
      return;
    }

    if (fluidColorCache.has(imageUrl)) {
      setColors(fluidColorCache.get(imageUrl)!);
      return;
    }

    let active = true;

    const process = (img: HTMLImageElement) => {
      const extracted = extractColorsFromImage(img);
      if (active) {
        fluidColorCache.set(imageUrl, extracted);
        setColors(extracted);
      }
    };

    const existingEl = getCoverElement(imageUrl);
    if (existingEl && existingEl.complete && existingEl.naturalWidth > 0) {
      process(existingEl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (active) process(img);
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
          process(fallbackEl);
        }
      });
    };
    img.src = imageUrl;

    return () => {
      active = false;
    };
  }, [imageUrl]);

  return colors;
}
