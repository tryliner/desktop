import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BraccatoLyricsElement } from "@braccato/core/element";
import { FullscreenPlayer } from "./FullscreenPlayer";
import { parseRawLyrics, useLyricsStore } from "@/features/lyrics";
import { debouncedStorage } from "@/shared/utils/storage";
import backgroundRomanization from "@/features/lyrics/fixtures/background-romanization.ttml?raw";
import japanese from "@/features/lyrics/fixtures/japanese.ttml?raw";

const state = vi.hoisted(() => ({
  status: "paused",
  positionMs: 1500,
  currentTrack: { id: "track-1", title: "Test" },
  queue: [],
  currentIndex: 0,
}));
const seek = vi.hoisted(() => vi.fn());
vi.mock("../hooks/usePlayerState", () => ({ usePlayerState: () => state }));
vi.mock("../engine/playerEngine", () => ({
  playerEngine: { getSnapshot: () => state, seek },
}));
vi.mock("@/features/covers", () => ({
  preloadCoverArt: vi.fn(),
  useCoverSrc: () => undefined,
}));
vi.mock("./PlayerUiElements", () => ({ PlayerUiElements: () => null }));
vi.mock("./KawarpWrapper", () => ({ default: () => null }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: React.forwardRef<HTMLDivElement, Record<string, unknown>>(
      (
        {
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          ...props
        },
        ref,
      ) => <div {...props} ref={ref} />,
    ),
  },
}));

describe("immersive lyric annotations", () => {
  let root: Root;
  let container: HTMLDivElement;
  let audio: HTMLAudioElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    localStorage.setItem("liner_locale", "en");
    useLyricsStore.getState().reset();
    useLyricsStore.setState({ showPronunciation: true, trackOffsets: {} });
    useLyricsStore.getState().setLyricsState({
      ...parseRawLyrics(japanese),
      currentLyricsTrackId: "track-1",
    });
    audio = document.createElement("audio");
    audio.id = "liner-audio";
    audio.currentTime = 1.5;
    document.body.appendChild(audio);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(<FullscreenPlayer effectsReady={false} onClose={vi.fn()} />),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    audio.remove();
    useLyricsStore.getState().reset();
    useLyricsStore.setState({ showPronunciation: true, trackOffsets: {} });
    debouncedStorage.removeItem("liner_lyrics_session_v1");
    localStorage.removeItem("liner_locale");
    state.status = "paused";
    state.positionMs = 1500;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("decorates initial loads and toggles while paused without rebuilding lyrics or rebinding audio", () => {
    const element =
      container.querySelector<BraccatoLyricsElement>("braccato-lyrics")!;
    expect(element.status).toBe("rendering");
    const originalLine = element.renderer!.lines[0].lyricElement;
    expect(originalLine.querySelector(".blyrics--translated")).toBeNull();
    expect(originalLine.querySelector(".blyrics--romanized")?.textContent).toBe(
      "sekai ga matteru",
    );
    const build = vi.spyOn(element.renderer!, "setLyrics");
    const relayout = vi.spyOn(element.renderer!, "relayout");
    const retick = vi.spyOn(element.renderer!, "retickFromPlaybackClock");
    act(() => useLyricsStore.getState().setShowPronunciation(false));
    expect(
      originalLine.querySelector<HTMLElement>(".blyrics--romanized")!.hidden,
    ).toBe(true);
    expect(element.renderer!.lines[0].lyricElement).toBe(originalLine);
    expect(element.mediaElement).toBe(audio);
    expect(audio.currentTime).toBe(1.5);
    expect(build).not.toHaveBeenCalled();
    expect(relayout).toHaveBeenCalled();
    expect(retick).toHaveBeenCalled();
  });

  it("redecorates offset and provider changes without stale or duplicate annotations", () => {
    const element =
      container.querySelector<BraccatoLyricsElement>("braccato-lyrics")!;
    act(() => useLyricsStore.getState().setOffset(500));
    expect(element.renderer!.lines[0].time).toBe(1.5);
    expect(element.querySelectorAll(".blyrics--romanized")).toHaveLength(1);
    act(() =>
      useLyricsStore
        .getState()
        .setLyricsState(parseRawLyrics("[00:01.00] Different source")),
    );
    expect(element.querySelector(".blyrics--translated")).toBeNull();
    expect(element.querySelector(".blyrics--romanized")).toBeNull();
    act(() =>
      useLyricsStore.getState().setLyricsState(parseRawLyrics(japanese)),
    );
    expect(element.querySelectorAll(".blyrics--romanized")).toHaveLength(1);
  });

  it("pairs each vocal with its own pronunciation without replacing background highlights", () => {
    act(() =>
      useLyricsStore
        .getState()
        .setLyricsState(parseRawLyrics(backgroundRomanization)),
    );
    const element =
      container.querySelector<BraccatoLyricsElement>("braccato-lyrics")!;
    const line = element.renderer!.lines[0];
    const originalParts = line.parts.slice(0, 4);
    const background = line.lyricElement.querySelector<HTMLElement>(
      ".blyrics-background-line",
    )!;
    const romanizations = line.lyricElement.querySelectorAll<HTMLElement>(
      ".blyrics--romanized",
    );
    expect(romanizations).toHaveLength(2);
    expect(
      romanizations[0].querySelector(".blyrics-bidi-run:not([aria-hidden])")
        ?.textContent,
    ).toBe("sekai e");
    expect(
      romanizations[1].querySelector(".blyrics-bidi-run:not([aria-hidden])")
        ?.textContent,
    ).toBe("koe hibike");
    expect(romanizations[0].nextElementSibling).toBe(background);
    expect(romanizations[1].parentElement).toBe(background);
    expect(originalParts.map((part) => [part.time, part.duration])).toEqual([
      [1, 1],
      [2, 2],
      [2.5, 0.5],
      [3, 1.5],
    ]);
    expect(
      line.parts.slice(4).map((part) => [part.time, part.duration]),
    ).toEqual([
      [1, 1],
      [2, 2],
      [2.5, 0.5],
      [3, 1.5],
    ]);
    for (const show of [false, true, false, true]) {
      act(() => useLyricsStore.getState().setShowPronunciation(show));
      expect([...romanizations].every((row) => row.hidden === !show)).toBe(
        true,
      );
      expect(
        line.lyricElement.querySelectorAll(".blyrics--romanized"),
      ).toHaveLength(2);
      expect(line.parts).toHaveLength(8);
      expect(line.parts.slice(0, 4)).toEqual(originalParts);
      expect(background.contains(originalParts[2].lyricElement)).toBe(true);
      expect(background.contains(originalParts[2].highlightElement)).toBe(true);
    }
    act(() => useLyricsStore.getState().setOffset(500));
    expect(element.renderer!.lines[0].parts.map((part) => part.time)).toEqual([
      1.5, 2.5, 3, 3.5, 1.5, 2.5, 3, 3.5,
    ]);
  });

  it.each(["playing", "paused"])(
    "keeps the current lyric centered when toggled during a scroll animation (%s)",
    (status) => {
      state.status = status;
      state.positionMs = 2500;
      act(() =>
        root.render(
          <FullscreenPlayer
            key="following"
            effectsReady={false}
            onClose={vi.fn()}
          />,
        ),
      );
      const element =
        container.querySelector<BraccatoLyricsElement>("braccato-lyrics")!;
      const renderer = element.renderer!;
      const line = renderer.lines[0];
      Object.defineProperty(renderer.container, "offsetTop", {
        configurable: true,
        value: 24,
      });
      line.lyricElement.classList.add("blyrics--active");
      vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        top: 100,
        height: 400,
      } as DOMRect);
      vi.spyOn(renderer, "relayout").mockImplementation(() => {
        line.position = useLyricsStore.getState().showPronunciation ? 900 : 600;
        line.height = useLyricsStore.getState().showPronunciation ? 120 : 80;
      });
      vi.spyOn(renderer, "retickFromPlaybackClock").mockReturnValue("ok");
      // A running scroll animation displaces the visual bounds from the measured layout.
      vi.spyOn(line.lyricElement, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            top: 100 + 24 + line.position - element.scrollTop + 300,
            height: line.height,
          }) as DOMRect,
      );
      for (const show of [false, true, false, true]) {
        act(() => useLyricsStore.getState().setShowPronunciation(show));
        expect(element.scrollTop).toBe(
          24 + line.position - 200 + line.height / 2,
        );
        expect(line.lyricElement.classList.contains("blyrics--active")).toBe(
          true,
        );
        expect(audio.currentTime).toBe(1.5);
      }
    },
  );

  it("keeps manual browsing active and avoids recentering when annotations change", () => {
    const element =
      container.querySelector<BraccatoLyricsElement>("braccato-lyrics")!;
    const resume = vi.spyOn(element.renderer!, "resumeAutoscroll");
    const rect = { top: 0, bottom: 100, height: 100 } as DOMRect;
    vi.spyOn(
      element.renderer!.lines[0].lyricElement,
      "getBoundingClientRect",
    ).mockReturnValue(rect);
    const scroll = vi.fn();
    element.scrollTo = scroll;
    element.scrollTop = 120;
    act(() => element.dispatchEvent(new WheelEvent("wheel")));
    act(() => useLyricsStore.getState().setShowPronunciation(false));
    expect(resume).not.toHaveBeenCalled();
    expect(scroll).not.toHaveBeenCalled();
    expect(element.scrollTop).toBe(120);
  });
});
