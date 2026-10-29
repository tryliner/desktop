import { injectRomanization, type LineData } from "@braccato/core";
import { ROMANIZED_LYRICS_CLASS } from "@braccato/core/constants";
import type { Lyric } from "@braccato/parsers";
import { romanizeLyrics } from "./lyricsRomanization";
import {
  providedRomanization,
  type RomanizationMode,
} from "./romanizationPreference";

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
  mode: RomanizationMode = "auto",
) {
  const renderer = host.renderer;
  if (!renderer || (enabled && lyrics.length !== renderer.lines.length)) return;
  const texts = enabled ? romanizeLyrics(lyrics, mode) : [];
  let changed = false;
  renderer.lines.forEach((line, i) => {
    const text = texts[i];
    const node = line.lyricElement.querySelector(`.${ROMANIZED_LYRICS_CLASS}`);
    if (node && text && node.textContent === text) return;
    if (node) {
      node.remove();
      changed = true;
    }
    if (!text) return;
    const timed =
      providedRomanization(lyrics[i]) === text
        ? lyrics[i].timedRomanization
        : undefined;
    injectRomanization(document, line.lyricElement, line, text, timed);
    if (line.lyricElement.querySelector(`.${ROMANIZED_LYRICS_CLASS}`))
      changed = true;
  });
  if (changed)
    renderer.scheduleLyricPositionUpdate(
      () => host.isConnected !== false,
      () => {},
    );
}
