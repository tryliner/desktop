import { vi } from "vitest";
import type { Lyric } from "@braccato/parsers";
import type { LineData } from "@braccato/core";

export function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export function lyric(words: string): Lyric {
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

export function fakeView(lyrics: Lyric[]) {
  const lines = lyrics.map((line) => {
    const element = document.createElement("div");
    element.textContent = line.words;
    return fakeLine(element);
  });
  const scheduleLyricPositionUpdate = vi.fn();
  const el = Object.assign(document.createElement("div"), {
    renderer: { lines, scheduleLyricPositionUpdate },
  });
  lines.forEach((line) => el.appendChild(line.lyricElement));
  return { el, lines, scheduleLyricPositionUpdate };
}
