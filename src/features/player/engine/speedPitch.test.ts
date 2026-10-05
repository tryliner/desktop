import { describe, it, expect, beforeEach } from "vitest";
import { playerEngine } from "./playerEngine";
import { usePlayerStore } from "../store/playerStore";
import { playerRuntime } from "./playerRuntime";

describe("Speed and Pitch Engine", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      playbackRate: 1.0,
      pitchSemitones: 0.0,
      isPitchLinked: true,
      keepSpeedAcrossTracks: true,
    });
  });

  it("updates playback rate and recalculates pitch when linked", () => {
    playerEngine.setPlaybackRate(1.25);
    const state = usePlayerStore.getState();
    expect(state.playbackRate).toBe(1.25);
    // 12 * log2(1.25) ≈ 3.86 -> 3.9
    expect(state.pitchSemitones).toBeCloseTo(3.9, 1);
  });

  it("updates pitch and recalculates playback rate when linked", () => {
    playerEngine.setPitchSemitones(3.9);
    const state = usePlayerStore.getState();
    // 2^(3.9/12) ≈ 1.252 -> 1.25
    expect(state.playbackRate).toBeCloseTo(1.25, 2);
    expect(state.pitchSemitones).toBe(3.9);
  });

  it("does not alter pitch when pitch is unlinked", () => {
    playerEngine.setIsPitchLinked(false);
    playerEngine.setPlaybackRate(1.5);
    const state = usePlayerStore.getState();
    expect(state.playbackRate).toBe(1.5);
    expect(state.pitchSemitones).toBe(0);
    expect(state.isPitchLinked).toBe(false);
  });

  it("allows setting pitch independently when unlinked without changing speed", () => {
    playerEngine.setIsPitchLinked(false);
    playerEngine.setPlaybackRate(1.2);
    playerEngine.setPitchSemitones(2.5);
    const state = usePlayerStore.getState();
    expect(state.playbackRate).toBe(1.2);
    expect(state.pitchSemitones).toBe(2.5);
    expect(state.isPitchLinked).toBe(false);
  });

  it("resyncs pitch to speed when relinking", () => {
    playerEngine.setIsPitchLinked(false);
    playerEngine.setPlaybackRate(1.25);
    playerEngine.setPitchSemitones(0);
    playerEngine.setIsPitchLinked(true);
    const state = usePlayerStore.getState();
    expect(state.pitchSemitones).toBeCloseTo(3.9, 1);
  });

  it("resets speed and pitch cleanly", () => {
    playerEngine.setPlaybackRate(1.35);
    playerEngine.resetSpeedAndPitch();
    const state = usePlayerStore.getState();
    expect(state.playbackRate).toBe(1.0);
    expect(state.pitchSemitones).toBe(0.0);
  });

  it("applies settings to audio element via PlayerRuntime", () => {
    if (!playerRuntime) return;
    playerEngine.setIsPitchLinked(true);
    playerEngine.setPlaybackRate(1.25);

    const audio = (playerRuntime as any).audio as HTMLAudioElement;
    expect(audio.playbackRate).toBe(1.25);
    expect(audio.preservesPitch).toBe(false);

    playerEngine.setIsPitchLinked(false);
    expect(audio.preservesPitch).toBe(true);
  });

  it("toggles and updates reverb settings cleanly", () => {
    playerEngine.setIsReverbEnabled(true);
    playerEngine.setReverbLevel(0.45);
    const state = usePlayerStore.getState();
    expect(state.isReverbEnabled).toBe(true);
    expect(state.reverbLevel).toBe(0.45);

    playerEngine.setIsReverbEnabled(false);
    expect(usePlayerStore.getState().isReverbEnabled).toBe(false);
  });
});
