import { pitchShifter } from "./pitchShifter";

export interface AudioVisualizerNode {
  analyser: AnalyserNode;
  getFrequencyData(): Uint8Array;
  getTimeDomainData(): Uint8Array;
  getFrequencyBinCount(): number;
  getFftSize(): number;
  setFftSize(size: number): void;
}

export class VisualizerNodeWrapper implements AudioVisualizerNode {
  public analyser: AnalyserNode;
  private freqBuffer: Uint8Array;
  private timeBuffer: Uint8Array;

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.freqBuffer = new Uint8Array(analyser.frequencyBinCount);
    this.timeBuffer = new Uint8Array(analyser.fftSize);
  }

  public getFrequencyData(): Uint8Array {
    if (this.freqBuffer.length !== this.analyser.frequencyBinCount) {
      this.freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    }
    this.analyser.getByteFrequencyData(this.freqBuffer as any);
    return this.freqBuffer;
  }

  public getTimeDomainData(): Uint8Array {
    if (this.timeBuffer.length !== this.analyser.fftSize) {
      this.timeBuffer = new Uint8Array(this.analyser.fftSize);
    }
    this.analyser.getByteTimeDomainData(this.timeBuffer as any);
    return this.timeBuffer;
  }

  public getFrequencyBinCount(): number {
    return this.analyser.frequencyBinCount;
  }

  public getFftSize(): number {
    return this.analyser.fftSize;
  }

  public setFftSize(size: number): void {
    // Setting analyser.fftSize validates powers of two and bounds (32 to 32768)
    // and throws IndexSizeError if invalid
    this.analyser.fftSize = size;
    this.freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeBuffer = new Uint8Array(this.analyser.fftSize);
  }
}

export function getAudioContext(): AudioContext | null {
  return (
    pitchShifter.getContext() ??
    (typeof window !== "undefined" ? (window as any).__liner_audio_context ?? null : null)
  );
}

export function getAudioAnalyser(): AnalyserNode | null {
  const analyser = pitchShifter.getAnalyser();
  if (analyser) {
    return analyser;
  }

  if (typeof window !== "undefined") {
    const win = window as any;
    if (win.__liner_audio_analyser) {
      return win.__liner_audio_analyser;
    }
    const audio =
      win.__liner_audio ||
      (typeof document !== "undefined" && document.getElementById("liner-audio"));
    if (audio) {
      pitchShifter.attach(audio as HTMLAudioElement);
      return pitchShifter.getAnalyser();
    }
  }

  return null;
}

export function getAudioVisualizerNode(): AudioVisualizerNode | null {
  const analyser = getAudioAnalyser();
  if (!analyser) return null;
  return new VisualizerNodeWrapper(analyser);
}

export async function ensureAudioContextRunning(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    await ctx.resume();
  } else {
    pitchShifter.resumeContext();
  }
}

export async function suspendAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "running") {
    await ctx.suspend();
  } else {
    await pitchShifter.suspendContext();
  }
}
