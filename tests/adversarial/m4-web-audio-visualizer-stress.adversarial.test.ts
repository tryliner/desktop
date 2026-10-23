import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import {
  installWebAudioMock,
  uninstallWebAudioMock,
  type MockAudioContext,
} from "../e2e/mocks/webAudioMock";
import {
  VisualizerNodeWrapper,
  getAudioContext,
  getAudioAnalyser,
  getAudioVisualizerNode,
  ensureAudioContextRunning,
  suspendAudioContext,
} from "../../src/features/player/engine/audioVisualizerNode";
import { AudioVisualizer } from "../../src/features/player/ui/AudioVisualizer";
import { pitchShifter } from "../../src/features/player/engine/pitchShifter";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Adversarial Stress Harness: Web Audio & Visualizer (M4.2)", () => {
  let mockContext: MockAudioContext;
  let audioContextMockHandle: ReturnType<typeof installWebAudioMock>;

  beforeEach(() => {
    audioContextMockHandle = installWebAudioMock();
    mockContext = new (window as any).AudioContext();
  });

  afterEach(() => {
    uninstallWebAudioMock();
    vi.restoreAllMocks();
  });

  describe("1. FFT Size Boundaries & Dynamic Resizing", () => {
    const VALID_FFT_SIZES = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

    it("dynamically resizes buffers across all 11 valid power-of-two sizes sequentially", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      for (const size of VALID_FFT_SIZES) {
        wrapper.setFftSize(size);

        expect(wrapper.getFftSize()).toBe(size);
        expect(wrapper.getFrequencyBinCount()).toBe(size / 2);

        const freqData = wrapper.getFrequencyData();
        const timeData = wrapper.getTimeDomainData();

        expect(freqData).toBeInstanceOf(Uint8Array);
        expect(freqData.length).toBe(size / 2);

        expect(timeData).toBeInstanceOf(Uint8Array);
        expect(timeData.length).toBe(size);
      }
    });

    it("handles 100 rapid random jumps across valid FFT sizes without buffer corruption", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      for (let i = 0; i < 100; i++) {
        const randomIndex = Math.floor(Math.random() * VALID_FFT_SIZES.length);
        const targetSize = VALID_FFT_SIZES[randomIndex];

        wrapper.setFftSize(targetSize);
        expect(wrapper.getFftSize()).toBe(targetSize);
        expect(wrapper.getFrequencyData().length).toBe(targetSize / 2);
        expect(wrapper.getTimeDomainData().length).toBe(targetSize);
      }
    });

    it("throws IndexSizeError on invalid integer FFT sizes (0, 16, 500, 65536, negative)", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      const invalidSizes = [0, 16, 500, 65536, -1, -1024, 31, 33, 1000];

      for (const invalid of invalidSizes) {
        expect(() => {
          wrapper.setFftSize(invalid);
        }).toThrow(/IndexSizeError/);
      }

      // Verify that after invalid attempts, the wrapper remains in a valid state
      expect(wrapper.getFftSize()).toBe(2048);
      expect(wrapper.getFrequencyBinCount()).toBe(1024);
      expect(wrapper.getFrequencyData().length).toBe(1024);
      expect(wrapper.getTimeDomainData().length).toBe(2048);
    });

    it("empirically demonstrates boundary vulnerability: setting fftSize to NaN fails to throw IndexSizeError and corrupts buffer state", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      // Web Audio specification mandates IndexSizeError for non-power-of-two values including NaN.
      // However, current implementation (MockAnalyserNode and VisualizerNodeWrapper) has a bitwise coercion flaw:
      // (NaN & (NaN - 1)) === 0 evaluates to true, and relational checks (NaN < 32, NaN > 32768) evaluate to false.
      let threwIndexSizeError = false;
      try {
        wrapper.setFftSize(NaN);
      } catch (err: any) {
        if (err.name === "IndexSizeError" || /IndexSizeError/.test(err.message)) {
          threwIndexSizeError = true;
        }
      }

      // VULNERABILITY CONFIRMATION:
      // In current code, setFftSize(NaN) DOES NOT THROW IndexSizeError.
      expect(threwIndexSizeError).toBe(false);

      // And it leaves the wrapper in an invalid / corrupted state:
      expect(Number.isNaN(wrapper.getFftSize())).toBe(true);
      expect(Number.isNaN(wrapper.getFrequencyBinCount())).toBe(true);
      // Buffers collapse to length 0
      expect(wrapper.getFrequencyData().length).toBe(0);
      expect(wrapper.getTimeDomainData().length).toBe(0);
    });
  });

  describe("2. Rapid Suspend / Resume Cycling", () => {
    it("survives 50 rapid consecutive toggles between suspended and running states with zero buffer leakage", async () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      for (let cycle = 0; cycle < 50; cycle++) {
        // Suspend
        await mockContext.suspend();
        expect(mockContext.state).toBe("suspended");

        const suspendedFreq = wrapper.getFrequencyData();
        const suspendedTime = wrapper.getTimeDomainData();

        // Must be all-zero spectrum on suspend
        const nonZeroFreq = Array.from(suspendedFreq).filter((v) => v > 0);
        expect(nonZeroFreq.length).toBe(0);

        // Time domain must be flat silence (128)
        const nonSilentTime = Array.from(suspendedTime).filter((v) => v !== 128);
        expect(nonSilentTime.length).toBe(0);

        // Resume
        await mockContext.resume();
        expect(mockContext.state).toBe("running");

        const runningFreq = wrapper.getFrequencyData();
        const runningTime = wrapper.getTimeDomainData();

        // Must have non-zero active spectrum
        const activeFreq = Array.from(runningFreq).filter((v) => v > 0);
        expect(activeFreq.length).toBeGreaterThan(0);

        // Time domain must oscillate around 128
        const activeWaveform = Array.from(runningTime).filter((v) => v !== 128);
        expect(activeWaveform.length).toBeGreaterThan(0);
      }
    });

    it("maintains buffer reference stability across repeated calls without reallocating when size unchanged", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      const firstFreq = wrapper.getFrequencyData();
      const secondFreq = wrapper.getFrequencyData();
      expect(firstFreq).toBe(secondFreq); // Same TypedArray instance

      const firstTime = wrapper.getTimeDomainData();
      const secondTime = wrapper.getTimeDomainData();
      expect(firstTime).toBe(secondTime); // Same TypedArray instance
    });
  });

  describe("3. Frequency & Time-Domain Sampling Integrity", () => {
    it("guarantees getFrequencyData().length == frequencyBinCount and getTimeDomainData().length == fftSize", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      for (const size of [64, 256, 1024, 4096]) {
        wrapper.setFftSize(size);
        const fCount = wrapper.getFrequencyBinCount();
        const fSize = wrapper.getFftSize();

        expect(wrapper.getFrequencyData().length).toBe(fCount);
        expect(wrapper.getTimeDomainData().length).toBe(fSize);
      }
    });

    it("verifies sample values are strictly bounded within [0, 255] byte ranges", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      const freqData = wrapper.getFrequencyData();
      const timeData = wrapper.getTimeDomainData();

      for (let i = 0; i < freqData.length; i++) {
        expect(freqData[i]).toBeGreaterThanOrEqual(0);
        expect(freqData[i]).toBeLessThanOrEqual(255);
      }

      for (let i = 0; i < timeData.length; i++) {
        expect(timeData[i]).toBeGreaterThanOrEqual(0);
        expect(timeData[i]).toBeLessThanOrEqual(255);
      }
    });

    it("dynamically self-heals when external code modifies analyser.fftSize directly without wrapper.setFftSize", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      expect(wrapper.getFftSize()).toBe(2048);
      expect(wrapper.getFrequencyData().length).toBe(1024);

      // External mutation of fftSize on underlying node
      analyser.fftSize = 512;
      expect(analyser.frequencyBinCount).toBe(256);

      // Wrapper getter should automatically detect mismatch and reallocate on next call
      const freqData = wrapper.getFrequencyData();
      expect(freqData.length).toBe(256);

      const timeData = wrapper.getTimeDomainData();
      expect(timeData.length).toBe(512);
    });
  });

  describe("4. Silence / Zero Volume Behavior", () => {
    it("returns all zeros in frequency data and 128 in time-domain data under silence", () => {
      const analyser = mockContext.createAnalyser() as unknown as AnalyserNode;
      const wrapper = new VisualizerNodeWrapper(analyser);

      // Set custom frequency data to pure silence [0]
      analyser.customFrequencyData = [0];

      const freqData = wrapper.getFrequencyData();
      const allZeros = Array.from(freqData).every((v) => v === 0);
      expect(allZeros).toBe(true);

      // Under suspended context, time domain is silence (128)
      mockContext.state = "suspended";
      const timeData = wrapper.getTimeDomainData();
      const all128 = Array.from(timeData).every((v) => v === 128);
      expect(all128).toBe(true);
    });
  });

  describe("5. Component Lifecycle Stress: Rapid Mount / Unmount", () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root?.unmount();
      });
      container?.remove();
      container = null;
      root = null;
    });

    it("rapidly mounts and unmounts AudioVisualizer 50 times in a loop with zero leaked RAFs or event listeners", () => {
      // Mock 2D canvas context and animation frame hooks
      const activeRafCallbacks = new Map<number, FrameRequestCallback>();
      let nextRafId = 1;

      const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
        const id = nextRafId++;
        activeRafCallbacks.set(id, cb);
        return id;
      });

      const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id: number) => {
        activeRafCallbacks.delete(id);
      });

      const visibilityListeners = new Set<EventListenerOrEventListenerObject>();
      const addEventSpy = vi.spyOn(document, "addEventListener").mockImplementation((event: string, listener: any) => {
        if (event === "visibilitychange") {
          visibilityListeners.add(listener);
        }
      });

      const removeEventSpy = vi.spyOn(document, "removeEventListener").mockImplementation((event: string, listener: any) => {
        if (event === "visibilitychange") {
          visibilityListeners.delete(listener);
        }
      });

      const mockCtx2d = {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        clearRect: vi.fn(),
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        beginPath: vi.fn(),
        fillRect: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
      };

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => {
        if (contextId === "2d") return mockCtx2d as any;
        return null;
      });

      // Rapid 50 iterations mount -> run -> unmount using React.createElement
      for (let i = 0; i < 50; i++) {
        act(() => {
          root?.render(
            React.createElement(AudioVisualizer, {
              mode: "bars",
              barCount: 32,
              isVisible: true,
            })
          );
        });

        // Verify RAF was scheduled
        expect(rafSpy).toHaveBeenCalled();

        // Simulate one animation frame tick if any callback is pending
        if (activeRafCallbacks.size > 0) {
          const [id, cb] = Array.from(activeRafCallbacks.entries())[0];
          activeRafCallbacks.delete(id);
          cb(performance.now());
        }

        // Unmount
        act(() => {
          root?.render(React.createElement(React.Fragment));
        });
      }

      // After 50 mount/unmount cycles:
      // 1. All RAF callbacks must be cancelled (zero active handles left)
      expect(activeRafCallbacks.size).toBe(0);

      // 2. All visibilitychange event listeners must be removed (zero leaked listeners)
      expect(visibilityListeners.size).toBe(0);

      // 3. ClearRect was invoked on unmount to release GPU canvas buffer
      expect(mockCtx2d.clearRect).toHaveBeenCalled();
    });
  });
});
