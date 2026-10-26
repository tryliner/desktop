import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LineData, Lyric } from "@braccato/core";
import {
  decorateLyricsLines,
  getLyricPronunciation,
} from "./engine/lyricsAnnotations";
import { applyLyricsOffset, parseRawLyrics } from "./engine/lyricsParser";
import { useLyricsStore } from "./store/lyricsStore";
import { debouncedStorage } from "@/shared/utils/storage";
import japanese from "./fixtures/japanese.ttml?raw";
import chinese from "./fixtures/chinese.ttml?raw";

function makeLines(lyrics: Lyric[]): LineData[] {
  return lyrics.map((lyric) => {
    const lyricElement = document.createElement("div");
    lyricElement.textContent = lyric.words;
    return {
      lyricElement,
      time: lyric.startTimeMs / 1000,
      duration: lyric.durationMs / 1000,
      parts: [],
      animations: [],
      isScrolled: false,
      isAnimationPlayStatePlaying: false,
      accumulatedOffsetMs: 0,
      isAnimating: false,
      lastAnimSetupAt: 0,
      isSelected: false,
      height: -1,
      position: -1,
      decorations: new Map(),
    };
  });
}

describe("lyric annotations", () => {
  it("preserves Japanese annotations and leaves uncovered lines original-only", () => {
    const { braccatoLyrics } = parseRawLyrics(japanese, "ttml");
    expect(getLyricPronunciation(braccatoLyrics[0])).toBe("sekai ga matteru");
    expect(getLyricPronunciation(braccatoLyrics[1])).toBeNull();
  });

  it.each(["[00:01.00] Hello world", "Hello world"])(
    "leaves lyrics without annotations unchanged: %s",
    (raw) => {
      const { braccatoLyrics } = parseRawLyrics(raw);
      const renderer = { lines: makeLines(braccatoLyrics) };
      decorateLyricsLines(renderer, braccatoLyrics, {
        showPronunciation: true,
      });
      expect(renderer.lines[0].lyricElement.children).toHaveLength(0);
      expect(renderer.lines[0].lyricElement.textContent).toBe("Hello world");
    },
  );

  it.each([false, true])(
    "shows pronunciation=%s without duplicating decorations or rendering translations",
    (showPronunciation) => {
      const { braccatoLyrics } = parseRawLyrics(japanese);
      const renderer = { lines: makeLines(braccatoLyrics) };
      const preferences = { showPronunciation };
      decorateLyricsLines(renderer, braccatoLyrics, preferences);
      decorateLyricsLines(renderer, braccatoLyrics, preferences);
      const decorations = renderer.lines[0].lyricElement.children;
      expect(decorations).toHaveLength(1);
      expect(decorations[0].classList.contains("blyrics--romanized")).toBe(
        true,
      );
      expect((decorations[0] as HTMLElement).hidden).toBe(!showPronunciation);
      expect(
        renderer.lines[0].lyricElement.querySelector(".blyrics--translated"),
      ).toBeNull();
      expect(renderer.lines[1].lyricElement.children).toHaveLength(0);
    },
  );

  it("keeps supplied Chinese pronunciation timing through offsets and repeated toggles", () => {
    const parsed = parseRawLyrics(chinese, "ttml");
    expect(parsed.braccatoLyrics[0].timedRomanization).toHaveLength(3);
    const adjusted = applyLyricsOffset(parsed, 500);
    const renderer = { lines: makeLines(adjusted.braccatoLyrics) };
    decorateLyricsLines(renderer, adjusted.braccatoLyrics, {
      showPronunciation: true,
    });
    const parts = renderer.lines[0].parts;
    expect(parts.map((part) => part.time)).toEqual([1.5, 2.5, 3.5]);
    expect(parts.map((part) => part.duration)).toEqual([1, 1, 2]);
    decorateLyricsLines(renderer, adjusted.braccatoLyrics, {
      showPronunciation: false,
    });
    decorateLyricsLines(renderer, adjusted.braccatoLyrics, {
      showPronunciation: true,
    });
    expect(renderer.lines[0].parts).toHaveLength(3);
    expect(parsed.braccatoLyrics[0].timedRomanization![0].startTimeMs).toBe(
      1000,
    );
  });

  it("omits blank annotations and annotations on instrumental lines", () => {
    const line = parseRawLyrics(japanese).braccatoLyrics[0];
    line.isInstrumental = true;
    expect(getLyricPronunciation(line)).toBeNull();
    const renderer = { lines: makeLines([line]) };
    decorateLyricsLines(renderer, [line], {
      showPronunciation: true,
    });
    expect(renderer.lines[0].lyricElement.children).toHaveLength(0);
    expect(
      getLyricPronunciation({
        ...line,
        isInstrumental: false,
        translations: { en: " " },
        translation: undefined,
        romanization: " ",
      }),
    ).toBeNull();
  });
});

describe("lyric language preferences", () => {
  beforeEach(() => {
    useLyricsStore.getState().reset();
    useLyricsStore.setState({
      showPronunciation: false,
    });
  });
  afterEach(() => {
    useLyricsStore.getState().reset();
    useLyricsStore.setState({
      showPronunciation: false,
    });
    debouncedStorage.removeItem("liner_lyrics_session_v1");
  });

  it("defaults pronunciation off and preserves opt-ins across track changes and resets", () => {
    const store = useLyricsStore.getState();
    expect(useLyricsStore.getInitialState().showPronunciation).toBe(false);
    expect(store.showPronunciation).toBe(false);
    store.setShowPronunciation(true);
    store.setLyricsState({ currentLyricsTrackId: "next-track" });
    store.reset();
    expect(useLyricsStore.getState().showPronunciation).toBe(true);
  });

  it("rehydrates saved choices and accepts older sessions without the new preferences", async () => {
    useLyricsStore.getState().setShowPronunciation(true);
    const saved = debouncedStorage.getItem("liner_lyrics_session_v1")!;
    useLyricsStore.setState({
      showPronunciation: false,
    });
    debouncedStorage.setItem("liner_lyrics_session_v1", saved);
    await useLyricsStore.persist.rehydrate();
    expect(useLyricsStore.getState().showPronunciation).toBe(true);
    useLyricsStore.setState({
      showPronunciation: false,
    });
    debouncedStorage.setItem(
      "liner_lyrics_session_v1",
      JSON.stringify({ state: { trackOffsets: { old: 200 } }, version: 0 }),
    );
    await useLyricsStore.persist.rehydrate();
    expect(useLyricsStore.getState().showPronunciation).toBe(false);
    expect(useLyricsStore.getState().trackOffsets.old).toBe(200);
  });
});
