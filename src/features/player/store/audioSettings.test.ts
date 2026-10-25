import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIO_SETTINGS,
  EQUALIZER_BANDS,
} from "./audioSettings";
import { debouncedStorage, usePlayerStore } from "./playerStore";

const storageKey = "liner_player_session_v2";

describe("persisted audio settings", () => {
  beforeEach(() => {
    usePlayerStore.setState(usePlayerStore.getInitialState(), true);
    debouncedStorage.removeItem(storageKey);
  });

  it("starts neutral and migrates older sessions without audio settings", async () => {
    debouncedStorage.setItem(
      storageKey,
      JSON.stringify({ state: { volume: 0.4 }, version: 0 }),
    );
    await usePlayerStore.persist.rehydrate();
    expect(usePlayerStore.getState()).toMatchObject({
      ...DEFAULT_AUDIO_SETTINGS,
      volume: 0.4,
    });
  });

  it("migrates the former three-band EQ into the nearest ten-band controls", async () => {
    debouncedStorage.setItem(
      storageKey,
      JSON.stringify({
        state: {
          isEqualizerEnabled: true,
          equalizerLow: 2.5,
          equalizerMid: -3,
          equalizerHigh: 1,
        },
        version: 0,
      }),
    );
    await usePlayerStore.persist.rehydrate();
    const bands = usePlayerStore.getState().equalizerBands;
    expect(bands[EQUALIZER_BANDS.findIndex((band) => band.id === "250")]).toBe(
      2.5,
    );
    expect(bands[EQUALIZER_BANDS.findIndex((band) => band.id === "1k")]).toBe(
      -3,
    );
    expect(bands[EQUALIZER_BANDS.findIndex((band) => band.id === "4k")]).toBe(
      1,
    );
  });

  it("clamps setters and rejects non-finite input", () => {
    const state = usePlayerStore.getState();
    state.setEqualizerBand("32", 15);
    state.setEqualizerBand("125", -20);
    state.setEqualizerBand("16k", NaN);
    state.setBassDepth(200);
    expect(usePlayerStore.getState()).toMatchObject({
      equalizerBands: [12, 0, -12, 0, 0, 0, 0, 0, 0, 0],
      bassDepth: 50,
    });
    state.setBassDepth(-100);
    expect(usePlayerStore.getState().bassDepth).toBe(-50);
  });

  it("validates persisted types, model IDs, and parameter bounds", async () => {
    debouncedStorage.setItem(
      storageKey,
      JSON.stringify({
        state: {
          isEqualizerEnabled: "yes",
          equalizerBands: [100, -100, "3"],
          isEnhancerEnabled: 1,
          enhancementEngine: "missing-model",
          enhancementPreset: "custom-preset",
          vocalClarity: 500,
          highEndAir: -100,
          bassDepth: 999,
        },
        version: 0,
      }),
    );
    await usePlayerStore.persist.rehydrate();
    expect(usePlayerStore.getState()).toMatchObject({
      isEqualizerEnabled: false,
      equalizerBands: [12, -12, 0, 0, 0, 0, 0, 0, 0, 0],
      isEnhancerEnabled: false,
      enhancementEngine: "hqmusic-3",
      enhancementPreset: "studio",
      vocalClarity: 50,
      highEndAir: -50,
      bassDepth: 50,
    });
  });

  it("applies the built-in Riff DSP presets", () => {
    const state = usePlayerStore.getState();
    state.setEnhancementPreset("vinyl");
    expect(usePlayerStore.getState()).toMatchObject({
      enhancementPreset: "vinyl",
      vocalClarity: 15,
      highEndAir: -15,
      bassDepth: 25,
    });
    state.setHighEndAir(10);
    expect(usePlayerStore.getState().enhancementPreset).toBe("custom");
  });

  it("persists effects even when track restoration is disabled", async () => {
    const state = usePlayerStore.getState();
    state.setDefaultPlaybackContext("empty");
    state.setIsEqualizerEnabled(true);
    state.setEqualizerBand("32", 2);
    state.setEqualizerBand("1k", -3);
    state.setEqualizerBand("8k", 1);
    state.setIsEnhancerEnabled(true);
    state.setEnhancementEngine("fyro1.1");
    state.setEnhancementPreset("concert");
    state.setVocalClarity(-10);
    state.setHighEndAir(30);
    state.setBassDepth(15);
    const saved = debouncedStorage.getItem(storageKey)!;
    usePlayerStore.setState(DEFAULT_AUDIO_SETTINGS);
    debouncedStorage.setItem(storageKey, saved);
    await usePlayerStore.persist.rehydrate();
    expect(usePlayerStore.getState()).toMatchObject({
      isEqualizerEnabled: true,
      isEnhancerEnabled: true,
      enhancementEngine: "fyro1.1",
      enhancementPreset: "custom",
      vocalClarity: -10,
      highEndAir: 30,
      bassDepth: 15,
    });
    expect(usePlayerStore.getState().equalizerBands).toEqual([
      2, 0, 0, 0, 0, -3, 0, 0, 1, 0,
    ]);
  });

  it("resets all processing while preserving volume, quality, and playback", () => {
    usePlayerStore.setState({
      isEqualizerEnabled: true,
      equalizerBands: EQUALIZER_BANDS.map(() => 9),
      isEnhancerEnabled: true,
      enhancementEngine: "glyphs-7B",
      enhancementPreset: "custom",
      vocalClarity: 50,
      highEndAir: -50,
      bassDepth: 40,
      playbackRate: 1.5,
      pitchSemitones: 4,
      isPitchLinked: false,
      isReverbEnabled: true,
      reverbLevel: 0.8,
      volume: 0.6,
      audioQuality: "high",
      positionMs: 1234,
      status: "playing",
    });
    usePlayerStore.getState().resetAudioEffects();
    expect(usePlayerStore.getState()).toMatchObject({
      ...DEFAULT_AUDIO_SETTINGS,
      playbackRate: 1,
      pitchSemitones: 0,
      isReverbEnabled: false,
      reverbLevel: 0.35,
      volume: 0.6,
      audioQuality: "high",
      positionMs: 1234,
      status: "playing",
    });
  });
});
