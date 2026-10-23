import { vi } from "vitest";

export interface MockAudioNode {
  context: MockAudioContext;
  numberOfInputs: number;
  numberOfOutputs: number;
  channelCount: number;
  connect(destination: MockAudioNode | any): MockAudioNode;
  disconnect(destination?: MockAudioNode | any): void;
}

export class MockGainNode implements MockAudioNode {
  public context: MockAudioContext;
  public numberOfInputs = 1;
  public numberOfOutputs = 1;
  public channelCount = 2;
  public gain = {
    value: 1,
    defaultValue: 1,
    setValueAtTime: vi.fn((val: number) => {
      this.gain.value = val;
    }),
    linearRampToValueAtTime: vi.fn((val: number) => {
      this.gain.value = val;
    }),
    exponentialRampToValueAtTime: vi.fn((val: number) => {
      this.gain.value = val;
    }),
  };
  public connections: any[] = [];

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  public connect(destination: any): any {
    this.connections.push(destination);
    return destination;
  }

  public disconnect(): void {
    this.connections = [];
  }
}

export class MockAnalyserNode implements MockAudioNode {
  public context: MockAudioContext;
  public numberOfInputs = 1;
  public numberOfOutputs = 1;
  public channelCount = 2;

  private _fftSize = 2048;
  public minDecibels = -100;
  public maxDecibels = -30;
  public smoothingTimeConstant = 0.8;
  public connections: any[] = [];
  public customFrequencyData: number[] | null = null;
  public isConnected = false;

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  public get fftSize(): number {
    return this._fftSize;
  }

  public set fftSize(size: number) {
    // Valid values are power of two between 32 and 32768
    const isPowerOfTwo = (size & (size - 1)) === 0;
    if (!isPowerOfTwo || size < 32 || size > 32768) {
      throw new DOMException("IndexSizeError: fftSize must be a power of 2 between 32 and 32768", "IndexSizeError");
    }
    this._fftSize = size;
  }

  public get frequencyBinCount(): number {
    return this._fftSize / 2;
  }

  public getByteFrequencyData(array: Uint8Array): void {
    if (this.context.state !== "running") {
      array.fill(0);
      return;
    }

    if (this.customFrequencyData && this.customFrequencyData.length > 0) {
      for (let i = 0; i < array.length; i++) {
        array[i] = this.customFrequencyData[i % this.customFrequencyData.length];
      }
      return;
    }

    // Default simulated spectrum with non-zero frequency curve
    for (let i = 0; i < array.length; i++) {
      // Simulate falloff across bins with low-end bass presence
      const factor = Math.max(0, 1 - i / (array.length * 0.75));
      array[i] = Math.floor(180 * factor);
    }
  }

  public getByteTimeDomainData(array: Uint8Array): void {
    if (this.context.state !== "running") {
      array.fill(128); // silent line
      return;
    }
    for (let i = 0; i < array.length; i++) {
      array[i] = 128 + Math.floor(40 * Math.sin((i / 16) * Math.PI));
    }
  }

  public getFloatFrequencyData(array: Float32Array): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = this.minDecibels + ((this.maxDecibels - this.minDecibels) * i) / array.length;
    }
  }

  public connect(destination: any): any {
    this.isConnected = true;
    this.connections.push(destination);
    return destination;
  }

  public disconnect(): void {
    this.isConnected = false;
    this.connections = [];
  }
}

export class MockMediaElementAudioSourceNode implements MockAudioNode {
  public context: MockAudioContext;
  public numberOfInputs = 0;
  public numberOfOutputs = 1;
  public channelCount = 2;
  public mediaElement: HTMLMediaElement;
  public connections: any[] = [];

  constructor(context: MockAudioContext, mediaElement: HTMLMediaElement) {
    this.context = context;
    this.mediaElement = mediaElement;
  }

  public connect(destination: any): any {
    this.connections.push(destination);
    return destination;
  }

  public disconnect(): void {
    this.connections = [];
  }
}

export class MockAudioContext {
  public state: "running" | "suspended" | "closed" = "running";
  public sampleRate = 44100;
  public currentTime = 0;
  public destination: MockAudioNode;
  public createdAnalysers: MockAnalyserNode[] = [];
  public createdGains: MockGainNode[] = [];

  constructor() {
    this.destination = {
      context: this,
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public createAnalyser(): MockAnalyserNode {
    const node = new MockAnalyserNode(this);
    this.createdAnalysers.push(node);
    return node;
  }

  public createGain(): MockGainNode {
    const node = new MockGainNode(this);
    this.createdGains.push(node);
    return node;
  }

  public createMediaElementSource(element: HTMLMediaElement): MockMediaElementAudioSourceNode {
    return new MockMediaElementAudioSourceNode(this, element);
  }

  public async resume(): Promise<void> {
    this.state = "running";
  }

  public async suspend(): Promise<void> {
    this.state = "suspended";
  }

  public async close(): Promise<void> {
    this.state = "closed";
  }
}

let originalAudioContext: any = undefined;
let originalWebkitAudioContext: any = undefined;
let originalAnalyserNode: any = undefined;

export function installWebAudioMock(): {
  getActiveContext: () => MockAudioContext | null;
  setFrequencyData: (data: number[]) => void;
} {
  let activeContext: MockAudioContext | null = null;
  let customData: number[] | null = null;

  if (typeof window !== "undefined") {
    originalAudioContext = (window as any).AudioContext;
    originalWebkitAudioContext = (window as any).webkitAudioContext;
    originalAnalyserNode = (window as any).AnalyserNode;

    const ContextConstructor = class extends MockAudioContext {
      constructor() {
        super();
        activeContext = this;
      }
    };

    (window as any).AudioContext = ContextConstructor;
    (window as any).webkitAudioContext = ContextConstructor;
    (window as any).AnalyserNode = MockAnalyserNode;
  }

  return {
    getActiveContext: () => activeContext,
    setFrequencyData: (data: number[]) => {
      customData = data;
      if (activeContext) {
        for (const analyser of activeContext.createdAnalysers) {
          analyser.customFrequencyData = data;
        }
      }
    },
  };
}

export function uninstallWebAudioMock(): void {
  if (typeof window !== "undefined") {
    (window as any).AudioContext = originalAudioContext;
    (window as any).webkitAudioContext = originalWebkitAudioContext;
    (window as any).AnalyserNode = originalAnalyserNode;
  }
}
