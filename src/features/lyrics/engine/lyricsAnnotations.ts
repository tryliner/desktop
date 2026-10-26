import {
  injectRomanization,
  type LyricsRenderer,
  type Lyric,
} from "@braccato/core";
import {
  BACKGROUND_LINE_CLASS,
  ROMANIZED_LYRICS_CLASS,
} from "@braccato/core/constants";

export function getLyricPronunciation(line: Lyric, isBackground = false) {
  if (line.isInstrumental) return null;
  if (line.timedRomanization?.length) {
    return (
      line.timedRomanization
        .filter((part) => Boolean(part.isBackground) === isBackground)
        .map((part) => part.words)
        .join("")
        .trim() || null
    );
  }
  return isBackground ? null : line.romanization?.trim() || null;
}

export function decorateLyricsLines(
  renderer: Pick<LyricsRenderer, "lines">,
  lyrics: Lyric[],
  preferences: { showPronunciation: boolean },
) {
  renderer.lines.forEach((line, index) => {
    const lyric = lyrics[index];
    if (!lyric) return;
    const element = line.lyricElement;
    const background = element.querySelector<HTMLElement>(
      `.${BACKGROUND_LINE_CLASS}`,
    );

    for (const isBackground of [false, true]) {
      const pronunciation = getLyricPronunciation(lyric, isBackground);
      const parent = isBackground ? background : element;
      if (!pronunciation || !parent) continue;
      injectRomanization(
        element.ownerDocument,
        parent,
        line,
        pronunciation,
        lyric.timedRomanization?.filter(
          (part) => Boolean(part.isBackground) === isBackground,
        ),
      );
      const romanized = parent.querySelector<HTMLElement>(
        `:scope > .${ROMANIZED_LYRICS_CLASS}`,
      );
      if (romanized) {
        romanized.hidden = !preferences.showPronunciation;
        if (!isBackground && background)
          element.insertBefore(romanized, background);
      }
    }
  });
}
