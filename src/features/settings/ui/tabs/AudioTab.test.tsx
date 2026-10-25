import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AudioTab } from "./AudioTab";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  DEFAULT_AUDIO_SETTINGS,
  EQUALIZER_BANDS,
} from "@/features/player/store/audioSettings";

// @ts-expect-error React act support flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Audio settings controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.setItem("liner_locale", "en");
    usePlayerStore.setState({
      ...usePlayerStore.getInitialState(),
      ...DEFAULT_AUDIO_SETTINGS,
    }, true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<AudioTab />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    )!;
  const slider = (label: string) =>
    container.querySelector<HTMLElement>(
      `[role="slider"][aria-label="${label}"]`,
    )!;
  const key = (element: HTMLElement, value: string) =>
    act(() =>
      element.dispatchEvent(
        new KeyboardEvent("keydown", { key: value, bubbles: true }),
      ),
    );

  it("shows ten neutral vertical EQ bands and signed enhancer ranges", () => {
    expect(container.querySelectorAll('[role="slider"]')).toHaveLength(13);
    expect(button("High Quality").getAttribute("aria-pressed")).toBe("false");
    expect(button("Equalizer").getAttribute("aria-pressed")).toBe("false");
    expect(slider("32 Hz").getAttribute("aria-disabled")).toBe("true");
    expect(slider("32 Hz").getAttribute("aria-valuemin")).toBe("-12");
    expect(slider("32 Hz").getAttribute("aria-valuemax")).toBe("12");
    expect(slider("Vocal Clarity").getAttribute("aria-valuemin")).toBe("-50");
    expect(slider("Vocal Clarity").getAttribute("aria-valuemax")).toBe("50");
    expect(container.querySelectorAll("select option")).toHaveLength(3);

    key(slider("32 Hz"), "ArrowUp");
    expect(usePlayerStore.getState().equalizerBands[0]).toBe(0);
  });

  it("applies EQ and enhancement changes through keyboard and preset controls", () => {
    act(() => {
      button("Equalizer").click();
      button("High Quality").click();
    });
    key(slider("32 Hz"), "ArrowUp");
    key(slider("Bass Depth"), "End");

    expect(usePlayerStore.getState()).toMatchObject({
      isEqualizerEnabled: true,
      equalizerBands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      isEnhancerEnabled: true,
      bassDepth: 50,
      enhancementPreset: "custom",
    });
    expect(slider("Bass Depth").getAttribute("aria-valuenow")).toBe("50");
    expect(container.textContent).toContain("+50%");

    act(() => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((element) => element.textContent === "Vinyl")
        ?.click();
    });
    expect(usePlayerStore.getState().enhancementPreset).toBe("vinyl");
    expect(usePlayerStore.getState()).toMatchObject({
      vocalClarity: 15,
      highEndAir: -15,
      bassDepth: 25,
    });
  });

  it("resets processing and preserves playback volume", () => {
    act(() =>
      usePlayerStore.setState({
        isEqualizerEnabled: true,
        equalizerBands: [5, 0, -3, 0, 0, 0, 0, 0, 0, 0],
        isEnhancerEnabled: true,
        bassDepth: 25,
        enhancementPreset: "custom",
        playbackRate: 1.5,
        pitchSemitones: 3,
        isReverbEnabled: true,
        volume: 0.3,
      }),
    );
    const reset = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === "Reset audio effects",
    )!;
    act(() => reset.click());
    expect(usePlayerStore.getState()).toMatchObject({
      ...DEFAULT_AUDIO_SETTINGS,
      playbackRate: 1,
      pitchSemitones: 0,
      isPitchLinked: true,
      isReverbEnabled: false,
      volume: 0.3,
    });
  });

  it("renders ten bands with the configured labels", () => {
    expect(EQUALIZER_BANDS.map((band) => band.label)).toEqual([
      "32 Hz",
      "64 Hz",
      "125 Hz",
      "250 Hz",
      "500 Hz",
      "1 kHz",
      "2 kHz",
      "4 kHz",
      "8 kHz",
      "16 kHz",
    ]);
    for (const band of EQUALIZER_BANDS) {
      expect(slider(band.label)).not.toBeNull();
    }
  });

  it("filters settings by translated search text", () => {
    act(() => root.render(<AudioTab searchQuery="Bass Depth" />));
    expect(slider("Bass Depth")).not.toBeNull();
    expect(slider("32 Hz")).toBeNull();
    act(() => root.render(<AudioTab searchQuery="Глубина баса" />));
    expect(slider("Bass Depth")).not.toBeNull();
  });
});
