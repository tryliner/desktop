import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getCoverElement,
  preloadCoverArt,
} from "@/features/covers/lib/coverArt";
import {
  readScreenCache,
  subscribeScreenCache,
  writeScreenCache,
} from "@/shared/cache/screenCache";
import {
  buildAccentBackdropSvg,
  svgToDataUrl,
} from "@/features/library/lib/likesCoverPalette";
import { extractColorsFromImage } from "../lib/extractFluidColors";
import { useSessionOwner } from "./sessionAwareLoad";
import type { DailyMix } from "./useDailyMixes";

interface HomeBackdropRecord {
  cover: string;
  backdrop: string;
}

function loadedCover(url: string): HTMLImageElement | undefined {
  const element = getCoverElement(url);
  if (!element || !element.complete || element.naturalWidth === 0)
    return undefined;
  return element;
}

export function useHomeBackdrop(mixes: DailyMix[]): {
  cover?: string;
  backdrop?: string;
} {
  const owner = useSessionOwner();
  const key = `home:backdrop:${owner}`;
  const cover = mixes[0]?.coverUrl || undefined;

  const subscribe = useCallback(
    (listener: () => void) => subscribeScreenCache(key, listener),
    [key],
  );
  const record = useSyncExternalStore(
    subscribe,
    () => readScreenCache<HomeBackdropRecord>(key)?.data,
  );
  const recordCover = record?.cover;

  useEffect(() => {
    if (!cover || recordCover === cover) return;
    let active = true;
    void preloadCoverArt(cover)
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        const element = loadedCover(cover);
        if (!element) return;
        const backdrop = svgToDataUrl(
          buildAccentBackdropSvg(extractColorsFromImage(element)),
        );
        writeScreenCache<HomeBackdropRecord>(key, { cover, backdrop });
      });
    return () => {
      active = false;
    };
  }, [key, cover, recordCover]);

  return {
    cover,
    backdrop: record?.backdrop,
  };
}
