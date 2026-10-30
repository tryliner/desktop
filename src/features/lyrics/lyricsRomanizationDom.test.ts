import { describe, expect, it, vi } from "vitest";
import type { Lyric } from "@braccato/parsers";
import type { LineData } from "@braccato/core";
import { syncRomanization } from "./hooks/useLyricsRomanization";

const ROMANIZED = ".blyrics--romanized";

function lyric(words: string): Lyric {
  return { startTimeMs: 0, durationMs: 1000, words };
}

function fakeLine(lyricElement: HTMLElement): LineData {
  return {
    lyricElement,
    parts: [],
    time: 0,
    duration: 1,
    animations: [],
    isScrolled: false,
    isAnimationPlayStatePlaying: false,
    accumulatedOffsetMs: 0,
    isAnimating: false,
    lastAnimSetupAt: 0,
    isSelected: false,
    height: 0,
    position: 0,
    decorations: new Map(),
  };
}

function fakeView(lyrics: Lyric[]) {
  const lines = lyrics.map((l) => {
    const lyricElement = document.createElement("div");
    lyricElement.textContent = l.words;
    return fakeLine(lyricElement);
  });
  const scheduleLyricPositionUpdate = vi.fn();
  const el = {
    renderer: {
      lines,
      scheduleLyricPositionUpdate,
    },
    isConnected: true,
  };
  return { el, lines, scheduleLyricPositionUpdate };
}

describe("syncRomanization", () => {
  const lyrics = [
    lyric("마지막처럼"),
    lyric("Cause, ooh"),
    lyric("도망가 여길 벗어나"),
  ];

  it("adds a romanized line under hangul lines only", () => {
    const { el, lines, scheduleLyricPositionUpdate } = fakeView(lyrics);
    syncRomanization(el, lyrics, true);

    expect(lines[0].lyricElement.querySelector(ROMANIZED)?.textContent).toBe(
      "majimakcheoreom",
    );
    expect(lines[1].lyricElement.querySelector(ROMANIZED)).toBeNull();
    expect(lines[2].lyricElement.querySelector(ROMANIZED)?.textContent).toBe(
      "domangga yeogil beoseona",
    );
    expect(scheduleLyricPositionUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not add a line twice or re-measure when nothing changed", () => {
    const { el, lines, scheduleLyricPositionUpdate } = fakeView(lyrics);
    syncRomanization(el, lyrics, true);
    syncRomanization(el, lyrics, true);

    expect(lines[0].lyricElement.querySelectorAll(ROMANIZED)).toHaveLength(1);
    expect(scheduleLyricPositionUpdate).toHaveBeenCalledTimes(1);
  });

  it("removes the romanized lines when turned off", () => {
    const { el, lines, scheduleLyricPositionUpdate } = fakeView(lyrics);
    syncRomanization(el, lyrics, true);
    syncRomanization(el, lyrics, false);

    for (const line of lines) {
      expect(line.lyricElement.querySelector(ROMANIZED)).toBeNull();
    }
    expect(scheduleLyricPositionUpdate).toHaveBeenCalledTimes(2);
  });

  it("does nothing when turned off and nothing was added", () => {
    const { el, scheduleLyricPositionUpdate } = fakeView(lyrics);
    syncRomanization(el, lyrics, false);
    expect(scheduleLyricPositionUpdate).not.toHaveBeenCalled();
  });

  it("skips a view whose lines do not match the lyrics yet", () => {
    const { el, lines } = fakeView(lyrics);
    syncRomanization(el, lyrics.slice(0, 2), true);
    expect(lines[0].lyricElement.querySelector(ROMANIZED)).toBeNull();
  });

  it("ignores an element with no renderer", () => {
    expect(() =>
      syncRomanization({ renderer: null }, lyrics, true),
    ).not.toThrow();
  });
});
