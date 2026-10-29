import { useEffect, type RefObject } from "react";
import { injectRomanization, type LineData } from "@braccato/core";
import { ROMANIZED_LYRICS_CLASS } from "@braccato/core/constants";
import type { Lyric } from "@braccato/parsers";
import { loadRomanizers, romanizeLyrics } from "../engine/lyricsRomanization";
import { useLyricsDisplayStore } from "../store/lyricsDisplayStore";

const LYRICS_LOADED_EVENT = "braccato:lyrics-loaded";

interface RomanizationRenderer {
  lines: readonly LineData[];
  scheduleLyricPositionUpdate(
    isTicking: () => boolean,
    retick: () => void,
  ): void;
}

export interface RomanizationHost {
  renderer: RomanizationRenderer | null;
  isConnected?: boolean;
}

export function syncRomanization(
  host: RomanizationHost,
  lyrics: Lyric[],
  enabled: boolean,
) {
  const renderer = host.renderer;
  if (!renderer) return;
  const lines = renderer.lines;
  let changed = false;

  if (enabled) {
    const texts = romanizeLyrics(lyrics);
    if (texts.length !== lines.length) return;
    lines.forEach((line, i) => {
      const text = texts[i];
      if (!text) return;
      if (line.lyricElement.querySelector(`.${ROMANIZED_LYRICS_CLASS}`)) return;
      injectRomanization(document, line.lyricElement, line, text);
      changed = true;
    });
  } else {
    for (const line of lines) {
      const node = line.lyricElement.querySelector(
        `.${ROMANIZED_LYRICS_CLASS}`,
      );
      if (!node) continue;
      node.remove();
      changed = true;
    }
  }

  if (changed) {
    renderer.scheduleLyricPositionUpdate(
      () => host.isConnected !== false,
      () => {},
    );
  }
}

export function useLyricsRomanization(
  elementRef: RefObject<(HTMLElement & RomanizationHost) | null>,
  lyrics: Lyric[],
) {
  const enabled = useLyricsDisplayStore((s) => s.romanization);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    let cancelled = false;
    const sync = () => {
      const ready = enabled ? loadRomanizers(lyrics) : Promise.resolve();
      ready
        .then(() => {
          if (!cancelled) syncRomanization(el, lyrics, enabled);
        })
        .catch(() => undefined);
    };
    sync();
    el.addEventListener(LYRICS_LOADED_EVENT, sync);
    return () => {
      cancelled = true;
      el.removeEventListener(LYRICS_LOADED_EVENT, sync);
    };
  }, [elementRef, lyrics, enabled]);
}
