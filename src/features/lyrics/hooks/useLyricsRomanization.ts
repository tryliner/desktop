import { useEffect, type RefObject } from "react";
import type { Lyric } from "@braccato/parsers";
import { loadRomanizers } from "../engine/lyricsRomanization";
import {
  syncRomanization,
  type RomanizationHost,
} from "../engine/lyricsRomanizationDom";
import { useLyricsDisplayStore } from "../store/lyricsDisplayStore";
import { useRomanizationRuntimeStore } from "../store/romanizationRuntimeStore";
import { useRomanizationPreference } from "./useRomanizationPreference";

export {
  syncRomanization,
  type RomanizationHost,
} from "../engine/lyricsRomanizationDom";

export function useLyricsRomanization(
  elementRef: RefObject<(HTMLElement & RomanizationHost) | null>,
  lyrics: Lyric[],
) {
  const enabled = useLyricsDisplayStore((state) => state.romanization);
  const { key, mode } = useRomanizationPreference(lyrics);
  const retryToken = useRomanizationRuntimeStore((state) => state.retryToken);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let cancelled = false;
    let generation = 0;
    const sync = async () => {
      const run = ++generation;
      const current = () => !cancelled && run === generation;
      const setStatus = useRomanizationRuntimeStore.getState().setStatus;
      syncRomanization(element, lyrics, enabled, mode);
      if (!enabled || mode === "off") {
        setStatus(key, "idle");
        return;
      }
      setStatus(key, "loading");
      let failed = false;
      try {
        await loadRomanizers(lyrics, mode);
      } catch {
        failed = true;
      }
      if (!current()) return;
      syncRomanization(element, lyrics, enabled, mode);
      setStatus(key, failed ? "error" : "ready");
    };
    const onLoaded = () => {
      void sync();
    };
    onLoaded();
    element.addEventListener("braccato:lyrics-loaded", onLoaded);
    return () => {
      cancelled = true;
      element.removeEventListener("braccato:lyrics-loaded", onLoaded);
    };
  }, [elementRef, lyrics, enabled, key, mode, retryToken]);
}
