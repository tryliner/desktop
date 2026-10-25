import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerRuntime } from "./playerRuntime";
import { pitchShifter } from "./pitchShifter";
import { usePlayerStore } from "../store/playerStore";
import { DEFAULT_AUDIO_SETTINGS } from "../store/audioSettings";

describe("PlayerRuntime audio settings", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      ...DEFAULT_AUDIO_SETTINGS,
      playbackRate: 1,
      pitchSemitones: 0,
      isPitchLinked: true,
      isReverbEnabled: false,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("leaves neutral playback alone until an effect needs the graph", () => {
    vi.spyOn(pitchShifter, "isAttached").mockReturnValue(false);
    const attach = vi
      .spyOn(pitchShifter, "attach")
      .mockImplementation(() => {});
    playerRuntime!.applyPlaybackRateAndPitch();
    expect(attach).not.toHaveBeenCalled();
  });

  it.each(["equalizer", "enhancer"])(
    "activates the graph for %s alone and applies changes immediately",
    (effect) => {
      vi.spyOn(pitchShifter, "isAttached").mockReturnValue(false);
      const attach = vi
        .spyOn(pitchShifter, "attach")
        .mockImplementation(() => {});
      const update = vi
        .spyOn(pitchShifter, "update")
        .mockImplementation(() => {});
      const state = usePlayerStore.getState();
      if (effect === "equalizer") {
        state.setIsEqualizerEnabled(true);
        state.setEqualizerBand("32", 4);
        expect(update).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isEqualizerEnabled: true,
            equalizerBands: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          }),
        );
      } else {
        state.setIsEnhancerEnabled(true);
        state.setEnhancementEngine("fyro1.1");
        state.setBassDepth(25);
        expect(update).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isEnhancerEnabled: true,
            enhancementEngine: "fyro1.1",
            bassDepth: 25,
          }),
        );
      }
      expect(attach).toHaveBeenCalled();
      vi.mocked(pitchShifter.isAttached).mockReturnValue(true);
      state.resetAudioEffects();
      expect(update).toHaveBeenLastCalledWith(
        expect.objectContaining(DEFAULT_AUDIO_SETTINGS),
      );
    },
  );
});
