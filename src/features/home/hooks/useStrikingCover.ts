import { useEffect, useState } from "react";
import { getCoverElement, preloadCoverArt } from "@/features/covers/lib/coverArt";
import { measureImageTone, pickStrikingIndex, type ImageTone } from "@/shared/lib/imageTone";

const toneCache = new Map<string, ImageTone>();

function readTone(url: string): ImageTone | undefined {
  const cached = toneCache.get(url);
  if (cached) return cached;
  const element = getCoverElement(url);
  if (!element || !element.complete || element.naturalWidth === 0) return undefined;
  const tone = measureImageTone(element);
  toneCache.set(url, tone);
  return tone;
}

export function useStrikingCover(urls: (string | undefined)[]): string | undefined {
  const candidates = urls.filter((url): url is string => Boolean(url));
  const key = candidates.join("|");
  const [picked, setPicked] = useState<string | undefined>(() => {
    const tones = candidates.map((url) => toneCache.get(url));
    return tones.every(Boolean) ? candidates[pickStrikingIndex(tones)] : candidates[0];
  });

  useEffect(() => {
    if (candidates.length === 0) {
      setPicked(undefined);
      return;
    }
    let active = true;
    setPicked((prev) => (prev && candidates.includes(prev) ? prev : candidates[0]));
    void Promise.all(candidates.map((url) => preloadCoverArt(url).catch(() => undefined))).then(() => {
      if (!active) return;
      const tones = candidates.map(readTone);
      setPicked(candidates[pickStrikingIndex(tones)]);
    });
    return () => {
      active = false;
    };
  }, [key]);

  return picked;
}
