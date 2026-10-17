import { afterEach, describe, expect, it, vi } from "vitest";
import { PitchShifterController, pitchShifter } from "./pitchShifter";
import { playerRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";

afterEach(() => vi.restoreAllMocks());

describe("lazy audio startup", () => {
  it("does not allocate an effects graph for native playback", () => {
    const controller = new PitchShifterController();
    const attach = vi.spyOn(controller, "attach").mockImplementation(() => {});
    controller.update({ pitchSemitones: 0, isPitchLinked: false, isReverbEnabled: false });
    controller.update({ pitchSemitones: 4, isPitchLinked: true, isReverbEnabled: true, reverbLevel: 0 });
    expect(attach).not.toHaveBeenCalled();
    controller.update({ pitchSemitones: 4, isPitchLinked: false });
    expect(attach).toHaveBeenCalledOnce();
  });

  it("creates effects on demand for reverb too", () => {
    const controller = new PitchShifterController();
    const attach = vi.spyOn(controller, "attach").mockImplementation(() => {});
    controller.update({ isReverbEnabled: true, reverbLevel: 0.4 });
    expect(attach).toHaveBeenCalledOnce();
  });

  it("defers effects and device enumeration until the first playback request", () => {
    const enumerateDevices = vi.fn().mockResolvedValue([]);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      enumerateDevices, addEventListener: vi.fn(),
    } });
    const update = vi.spyOn(pitchShifter, "update").mockImplementation(() => {});
    usePlayerStore.setState({ isReverbEnabled: true, reverbLevel: 0.4 });
    expect(update).not.toHaveBeenCalled();
    expect(enumerateDevices).not.toHaveBeenCalled();
    const audio = document.getElementById("liner-audio") as HTMLAudioElement;
    audio.src = "https://example.test/audio";
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    playerRuntime!.resume();
    playerRuntime!.resume();
    expect(enumerateDevices).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalled();
  });
});
