import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PitchShifterController } from "./pitchShifter";

const param = (value = 0) => ({
  value,
  setTargetAtTime: vi.fn(),
  setValueAtTime: vi.fn(),
});
const node = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: param(),
  frequency: param(),
  Q: param(),
  delayTime: param(),
  threshold: param(),
  knee: param(),
  ratio: param(),
  attack: param(),
  release: param(),
  curve: null as Float32Array | null,
  oversample: "none",
  start: vi.fn(),
});

class MockAudioContext {
  currentTime = 2;
  sampleRate = 44100;
  state = "running";
  destination = node();
  createGain = () => ({ ...node(), gain: param(1) });
  createDelay = node;
  createBufferSource = node;
  createBiquadFilter = node;
  createDynamicsCompressor = node;
  createWaveShaper = node;
  createConvolver = node;
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  });
  createMediaElementSource = vi.fn((audio: HTMLAudioElement) => ({
    ...node(),
    mediaElement: audio,
  }));
  resume = vi.fn().mockResolvedValue(undefined);
}

describe("shared audio effects graph", () => {
  let controller: PitchShifterController;
  let audio: HTMLAudioElement;
  const win = window as any;

  beforeEach(() => {
    vi.stubGlobal("AudioContext", MockAudioContext);
    controller = new PitchShifterController();
    audio = document.createElement("audio");
    controller.attach(audio);
  });

  afterEach(() => {
    delete win.__liner_audio_context;
    delete win.__liner_media_source_node;
    delete win.__liner_pitch_graph;
    vi.unstubAllGlobals();
  });

  const target = (p: any) => p.setTargetAtTime.mock.lastCall?.[0];

  it("routes ten EQ bands and the HQ processing chain before dry/reverb", () => {
    const g = (audio as any).__liner_pitch_graph;
    expect(g.pitchStageOutput.connect).toHaveBeenCalledWith(g.toneHeadroom);
    expect(g.toneHeadroom.connect).toHaveBeenCalledWith(g.equalizerBands[0]);
    for (let index = 0; index < g.equalizerBands.length - 1; index++) {
      expect(g.equalizerBands[index].connect).toHaveBeenCalledWith(
        g.equalizerBands[index + 1],
      );
    }
    expect(g.equalizerBands.at(-1).connect).toHaveBeenCalledWith(
      g.hqCompressor,
    );
    expect(g.hqCompressor.connect).toHaveBeenCalledWith(g.hqBass);
    expect(g.hqBass.connect).toHaveBeenCalledWith(g.hqVocal);
    expect(g.hqVocal.connect).toHaveBeenCalledWith(g.hqAir);
    expect(g.hqAir.connect).toHaveBeenCalledWith(g.hqSaturation);
    expect(g.hqSaturation.connect).toHaveBeenCalledWith(g.hqLimiter);
    expect(g.hqLimiter.connect).toHaveBeenCalledWith(g.postEnhancement);
    expect(g.postEnhancement.connect).toHaveBeenCalledWith(g.masterDryGain);
    expect(g.postEnhancement.connect).toHaveBeenCalledWith(g.reverbSendGain);
  });

  it("updates ten-band EQ and HQ profiles live without replacing pitch/reverb", () => {
    controller.update({
      isEqualizerEnabled: true,
      equalizerBands: [9, -3, 4, 0, 0, 0, 0, 0, 0, 0],
      isEnhancerEnabled: true,
      enhancementEngine: "hqmusic-3",
      vocalClarity: 25,
      highEndAir: 0,
      bassDepth: 25,
      isPitchLinked: false,
      pitchSemitones: 3,
      isReverbEnabled: true,
      reverbLevel: 0.5,
    });
    const g = (audio as any).__liner_pitch_graph;
    expect(target(g.equalizerBands[0].gain)).toBe(9);
    expect(target(g.equalizerBands[1].gain)).toBe(-3);
    expect(target(g.equalizerBands[2].gain)).toBe(4);
    expect(target(g.hqBass.gain)).toBe(2);
    expect(target(g.hqVocal.gain)).toBe(2);
    expect(target(g.hqAir.gain)).toBe(0);
    expect(g.hqCompressor.ratio.value).toBe(1.5);
    expect(g.hqLimiter.ratio.value).toBe(20);
    expect(target(g.toneHeadroom.gain)).toBeCloseTo(
      Math.pow(10, -13 / 20) / 1.5,
    );
    expect(target(g.pitchWetGain.gain)).toBe(1);
    expect(target(g.reverbWetGain.gain)).toBe(0.5);
  });

  it.each([
    ["glyphs-7B", 0, 2.5, 1.5],
    ["fyro1.1", 3, 0, 2],
  ] as const)(
    "uses the %s engine's actual Web Audio profile",
    (engine, bassBase, airBase, compressorRatio) => {
      controller.update({ isEnhancerEnabled: true, enhancementEngine: engine });
      const g = (audio as any).__liner_pitch_graph;
      expect(target(g.hqBass.gain)).toBe(bassBase);
      expect(target(g.hqAir.gain)).toBe(airBase);
      expect(g.hqCompressor.ratio.value).toBe(compressorRatio);
      expect(g.hqSaturation.curve).toBeInstanceOf(Float32Array);
      if (engine === "fyro1.1") {
        expect(g.hqBass.frequency.value).toBe(80);
      } else {
        expect(g.hqAir.frequency.value).toBe(9000);
      }
    },
  );

  it("bypasses EQ and HQ effects when disabled even with saved boosts", () => {
    controller.update({
      equalizerBands: [12, 12, 12, 0, 0, 0, 0, 0, 0, 0],
      vocalClarity: 50,
      highEndAir: 50,
      bassDepth: 50,
    });
    const g = (audio as any).__liner_pitch_graph;
    expect(target(g.equalizerBands[0].gain)).toBe(0);
    expect(target(g.hqBass.gain)).toBe(0);
    expect(target(g.hqVocal.gain)).toBe(0);
    expect(target(g.hqAir.gain)).toBe(0);
    expect(g.hqCompressor.ratio.value).toBe(1);
    expect(g.hqLimiter.ratio.value).toBe(1);
    expect(target(g.toneHeadroom.gain)).toBe(1);
    expect(target(g.pitchDryGain.gain)).toBe(1);
  });

  it("reuses the graph and media source across attachments and track changes", () => {
    const graph = (audio as any).__liner_pitch_graph;
    audio.src = "https://example.com/next.mp3";
    controller.attach(audio);
    new PitchShifterController().attach(audio);
    expect((audio as any).__liner_pitch_graph).toBe(graph);
    expect(
      win.__liner_audio_context.createMediaElementSource,
    ).toHaveBeenCalledTimes(1);
  });
});
