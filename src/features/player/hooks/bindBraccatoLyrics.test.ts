import { afterEach, describe, expect, it, vi } from "vitest";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import { bindBraccatoLyrics } from "./bindBraccatoLyrics";
import type { LyricsScrollState } from "./useLyricsScroll";

vi.mock("@/features/lyrics", () => ({ braccatoThemeCss: "" }));
vi.mock("../engine/playerEngine", () => ({ playerEngine: {} }));
vi.mock("./watchActiveLyric", () => ({ watchActiveLyric: () => vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe("lyrics-loaded scheduled scrolling", () => {
  it.each([
    "isInFreeSearchRef",
    "pinnedToTopRef",
    "waitingForAudioAfterClickRef",
    null,
  ] as const)("rechecks %s before scrolling", (guard) => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const element = document.createElement(
      "braccato-lyrics",
    ) as BraccatoLyricsElement;
    const scroll: LyricsScrollState = {
      elementRef: { current: element },
      freeScrollTimerRef: { current: null },
      isInFreeSearchRef: { current: false },
      waitingForAudioAfterClickRef: { current: false },
      pinnedToTopRef: { current: false },
      scrollToActiveLine: vi.fn(() => true),
      returnToFollowingMode: vi.fn(),
      returnToFollowingModeRef: { current: vi.fn() },
      handleUserInteractionRef: { current: vi.fn() },
    };
    const updateAnnotations = vi.fn();
    const cleanup = bindBraccatoLyrics(
      element,
      scroll,
      { current: [] },
      updateAnnotations,
    );
    try {
      element.dispatchEvent(new Event("braccato:lyrics-loaded"));
      expect(updateAnnotations).toHaveBeenCalledOnce();
      expect(frames).toHaveLength(1);
      expect(scroll.scrollToActiveLine).not.toHaveBeenCalled();
      if (guard) scroll[guard].current = true;
      frames[0](0);
      if (guard) {
        expect(scroll.scrollToActiveLine).not.toHaveBeenCalled();
      } else {
        expect(scroll.scrollToActiveLine).toHaveBeenCalledExactlyOnceWith(
          "auto",
        );
      }
    } finally {
      cleanup();
    }
  });
});
