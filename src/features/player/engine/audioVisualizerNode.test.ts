import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installWebAudioMock,
  uninstallWebAudioMock,
  type MockAudioContext,
} from "../../../../tests/e2e/mocks/webAudioMock";
import {
  VisualizerNodeWrapper,
  getAudioContext,
  getAudioAnalyser,
  getAudioVisualizerNode,
  ensureAudioContextRunning,
  suspendAudioContext,
} from "./audioVisualizerNode";
import { pitchShifter } from "./pitchShifter";

describe("audioVisualizerNode engine", () => {
  let mockContext: MockAudioContext;

  beforeEach(() => {
    installWebAudioMock();
    mockContext = new (window as any).AudioContext();
  });

  afterEach(() => {
    uninstallWebAudioMock();
    vi.restoreAllMocks();
  });

  describe("VisualizerNodeWrapper", () => {
    it("initializes with default fftSize 2048 and frequencyBinCount 1024", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const node = new VisualizerNodeWrapper(analyser);

      expect(node.getFftSize()).toBe(2048);
      expect(node.getFrequencyBinCount()).toBe(1024);
      expect(node.analyser).toBe(analyser);
    });

    it("samples non-zero frequency spectrum data during running state", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const node = new VisualizerNodeWrapper(analyser);

      const freqData = node.getFrequencyData();
      expect(freqData).toBeInstanceOf(Uint8Array);
      expect(freqData.length).toBe(1024);

      const nonZero = Array.from(freqData).filter((v) => v > 0);
      expect(nonZero.length).toBeGreaterThan(0);
      expect(freqData[0]).toBeGreaterThan(50);
    });

    it("samples time-domain waveform data fluctuating around 128", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const node = new VisualizerNodeWrapper(analyser);

      const timeData = node.getTimeDomainData();
      expect(timeData).toBeInstanceOf(Uint8Array);
      expect(timeData.length).toBe(2048);

      const hasFluctuation = Array.from(timeData).some((v) => v !== 128);
      expect(hasFluctuation).toBe(true);
    });

    it("returns all zeros when AudioContext is suspended", async () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const node = new VisualizerNodeWrapper(analyser);

      await mockContext.suspend();
      expect(mockContext.state).toBe("suspended");

      const freqData = node.getFrequencyData();
      const sum = Array.from(freqData).reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    });

    it("throws IndexSizeError when setting invalid fftSize", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const node = new VisualizerNodeWrapper(analyser);

      expect(() => node.setFftSize(500)).toThrow(/IndexSizeError/);
      expect(() => node.setFftSize(16)).toThrow(/IndexSizeError/);
      expect(() => node.setFftSize(65536)).toThrow(/IndexSizeError/);
    });

    it("correctly updates fftSize and frequencyBinCount when valid", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const node = new VisualizerNodeWrapper(analyser);

      node.setFftSize(1024);
      expect(node.getFftSize()).toBe(1024);
      expect(node.getFrequencyBinCount()).toBe(512);
      expect(node.getFrequencyData().length).toBe(512);
      expect(node.getTimeDomainData().length).toBe(1024);
    });
  });

  describe("Singletons and Lifecycle Functions", () => {
    it("returns null or attached analyser via getAudioAnalyser", () => {
      const audioEl = document.createElement("audio");
      audioEl.id = "liner-audio";
      document.body.appendChild(audioEl);

      pitchShifter.attach(audioEl);

      const analyser = getAudioAnalyser();
      expect(analyser).not.toBeNull();
      expect(analyser?.fftSize).toBe(2048);

      const vizNode = getAudioVisualizerNode();
      expect(vizNode).not.toBeNull();
      expect(vizNode?.getFftSize()).toBe(2048);

      document.body.removeChild(audioEl);
    });

    it("toggles AudioContext suspended and running via ensureAudioContextRunning & suspendAudioContext", async () => {
      const audioEl = document.createElement("audio");
      audioEl.id = "liner-audio";
      document.body.appendChild(audioEl);
      pitchShifter.attach(audioEl);

      const ctx = getAudioContext();
      expect(ctx).not.toBeNull();

      await suspendAudioContext();
      expect(ctx?.state).toBe("suspended");

      await ensureAudioContextRunning();
      expect(ctx?.state).toBe("running");

      document.body.removeChild(audioEl);
    });
  });
});
