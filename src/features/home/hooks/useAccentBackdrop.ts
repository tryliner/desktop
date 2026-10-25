import { useEffect, useState } from "react";
import { getCoverElement, preloadCoverArt } from "@/features/covers/lib/coverArt";
import { extractColorsFromImage } from "../lib/extractFluidColors";
import { buildAccentBackdropSvg, svgToDataUrl } from "@/features/library/lib/likesCoverPalette";

const backdropCache = new Map<string, string>();

export function useAccentBackdrop(coverUrl: string | undefined): string | undefined {
  const [backdrop, setBackdrop] = useState<string | undefined>(() =>
    coverUrl ? backdropCache.get(coverUrl) : undefined,
  );

  useEffect(() => {
    if (!coverUrl) {
      setBackdrop(undefined);
      return;
    }
    const cached = backdropCache.get(coverUrl);
    if (cached) {
      setBackdrop(cached);
      return;
    }
    let active = true;
    void preloadCoverArt(coverUrl)
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        const element = getCoverElement(coverUrl);
        if (!element || !element.complete || element.naturalWidth === 0) return;
        const next = svgToDataUrl(buildAccentBackdropSvg(extractColorsFromImage(element)));
        backdropCache.set(coverUrl, next);
        setBackdrop(next);
      });
    return () => {
      active = false;
    };
  }, [coverUrl]);

  return backdrop;
}
