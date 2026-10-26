import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LyricsPronunciationToggle } from "./LyricsPronunciationToggle";
import { useLyricsStore } from "../store/lyricsStore";
import { parseRawLyrics } from "../engine/lyricsParser";
import { debouncedStorage } from "@/shared/utils/storage";
import backgroundRomanization from "../fixtures/background-romanization.ttml?raw";
import japanese from "../fixtures/japanese.ttml?raw";

describe("LyricsPronunciationToggle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.setItem("liner_locale", "en");
    useLyricsStore.getState().reset();
    useLyricsStore.setState({ showPronunciation: false });
    useLyricsStore.getState().setLyricsState(parseRawLyrics(japanese));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<LyricsPronunciationToggle />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useLyricsStore.getState().reset();
    useLyricsStore.setState({ showPronunciation: false });
    debouncedStorage.removeItem("liner_lyrics_session_v1");
    localStorage.removeItem("liner_locale");
    vi.unstubAllGlobals();
  });

  it("toggles pronunciation directly and keeps keyboard focus on the control", () => {
    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(button.getAttribute("aria-label")).toBe("Pronunciation");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-haspopup")).toBeNull();
    act(() => button.focus());
    act(() => button.click());
    expect(useLyricsStore.getState().showPronunciation).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(button);
    act(() => button.click());
    expect(useLyricsStore.getState().showPronunciation).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("hides unavailable pronunciation without changing the saved preference", () => {
    act(() => useLyricsStore.getState().setShowPronunciation(true));
    act(() =>
      useLyricsStore
        .getState()
        .setLyricsState(parseRawLyrics("[00:01.00] Hello")),
    );
    expect(container.children).toHaveLength(0);
    expect(useLyricsStore.getState().showPronunciation).toBe(true);
    act(() =>
      useLyricsStore.getState().setLyricsState(parseRawLyrics(japanese)),
    );
    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("offers pronunciation when only the background vocal provides it", () => {
    const parsed = parseRawLyrics(backgroundRomanization);
    parsed.braccatoLyrics[0].timedRomanization =
      parsed.braccatoLyrics[0].timedRomanization!.filter(
        (part) => part.isBackground,
      );
    act(() => useLyricsStore.getState().setLyricsState(parsed));
    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(button.disabled).toBe(false);
    act(() => button.click());
    expect(useLyricsStore.getState().showPronunciation).toBe(true);
  });

  it("hides the control when lyrics are cleared", () => {
    act(() => useLyricsStore.getState().reset());
    expect(container.querySelector("button")).toBeNull();
  });
});
