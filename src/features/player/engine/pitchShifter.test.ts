import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PitchShifterController,
  type AudioEffectsParams,
} from "./pitchShifter";
import { EQ_PRESETS } from "./equalizer";

type Target = FakeNode | FakeParam;

class FakeParam {
  value: number;
  owner: FakeNode;

  constructor(owner: FakeNode, value: number) {
    this.owner = owner;
    this.value = value;
  }

  setValueAtTime(value: number) {
    this.value = value;
    return this;
  }

  setTargetAtTime(value: number) {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number) {
    this.value = value;
    return this;
  }

  cancelScheduledValues() {
    return this;
  }

  cancelAndHoldAtTime() {
    return this;
  }
}

class FakeNode {
  kind: string;
  ctx: FakeAudioContext;
  outputs = new Set<Target>();

  constructor(ctx: FakeAudioContext, kind: string) {
    this.ctx = ctx;
    this.kind = kind;
    ctx.nodes.push(this);
  }

  connect(target: Target) {
    this.outputs.add(target);
    return target;
  }

  disconnect(target?: Target) {
    if (target) this.outputs.delete(target);
    else this.outputs.clear();
  }
}

class FakeGain extends FakeNode {
  gain: FakeParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx, "gain");
    this.gain = new FakeParam(this, 1);
  }
}

class FakeDelay extends FakeNode {
  delayTime: FakeParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx, "delay");
    this.delayTime = new FakeParam(this, 0);
  }
}

class FakeBiquad extends FakeNode {
  type = "lowpass";
  frequency: FakeParam;
  Q: FakeParam;
  gain: FakeParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx, "biquad");
    this.frequency = new FakeParam(this, 350);
    this.Q = new FakeParam(this, 1);
    this.gain = new FakeParam(this, 0);
  }
}

class FakeConvolver extends FakeNode {
  normalize = true;
  buffer: unknown = null;
  constructor(ctx: FakeAudioContext) {
    super(ctx, "convolver");
  }
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  started = false;
  stopped = false;
  constructor(ctx: FakeAudioContext) {
    super(ctx, "bufferSource");
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam(this, -18);
  knee = new FakeParam(this, 24);
  ratio = new FakeParam(this, 4);
  attack = new FakeParam(this, 0.005);
  release = new FakeParam(this, 0.15);
  constructor(ctx: FakeAudioContext) {
    super(ctx, "compressor");
  }
}

class FakeSplitter extends FakeNode {
  constructor(ctx: FakeAudioContext) {
    super(ctx, "channelSplitter");
  }
}

class FakeMerger extends FakeNode {
  constructor(ctx: FakeAudioContext) {
    super(ctx, "channelMerger");
  }
}

class FakeAnalyser extends FakeNode {
  fftSize = 256;
  constructor(ctx: FakeAudioContext) {
    super(ctx, "analyser");
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  nodes: FakeNode[] = [];
  state: "running" | "suspended" | "closed" = "suspended";
  currentTime = 0;
  sampleRate = 8000;
  destination: FakeNode;

  constructor() {
    this.destination = new FakeNode(this, "destination");
    FakeAudioContext.instances.push(this);
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }

  createGain() {
    return new FakeGain(this);
  }

  createDelay() {
    return new FakeDelay(this);
  }

  createBiquadFilter() {
    return new FakeBiquad(this);
  }

  createConvolver() {
    return new FakeConvolver(this);
  }

  createBufferSource() {
    return new FakeBufferSource(this);
  }

  createDynamicsCompressor() {
    return new FakeCompressor(this);
  }

  createChannelSplitter() {
    return new FakeSplitter(this);
  }

  createChannelMerger() {
    return new FakeMerger(this);
  }

  createAnalyser() {
    return new FakeAnalyser(this);
  }

  createMediaElementSource(mediaElement: HTMLMediaElement) {
    const node = new FakeNode(this, "mediaSource");
    (node as any).mediaElement = mediaElement;
    return node;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    return {
      length,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: (i: number) => data[i],
    };
  }
}

function reachesDestination(ctx: FakeAudioContext): Set<FakeNode> {
  const live = new Set<FakeNode>([ctx.destination]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of ctx.nodes) {
      if (live.has(node)) continue;
      for (const target of node.outputs) {
        const owner = target instanceof FakeParam ? target.owner : target;
        if (live.has(owner)) {
          live.add(node);
          changed = true;
          break;
        }
      }
    }
  }
  return live;
}

function measure() {
  const ctx = FakeAudioContext.instances[0];
  const live = reachesDestination(ctx);
  const inPath = (kind: string) =>
    ctx.nodes.filter((node) => node.kind === kind && live.has(node)).length;
  return {
    convolvers: inPath("convolver"),
    runningSources: ctx.nodes.filter(
      (node) =>
        node instanceof FakeBufferSource && node.started && !node.stopped,
    ).length,
    delays: inPath("delay"),
    biquads: inPath("biquad"),
    nodesInPath: live.size,
    suspended: ctx.state === "suspended",
  };
}

describe("audio effects graph idle cost", () => {
  let audio: HTMLAudioElement;
  let paused: boolean;
  let controller: PitchShifterController;

  const play = () => {
    paused = false;
    audio.dispatchEvent(new Event("play"));
    audio.dispatchEvent(new Event("playing"));
  };

  const pause = () => {
    paused = true;
    audio.dispatchEvent(new Event("pause"));
  };

  const settle = async () => {
    await vi.advanceTimersByTimeAsync(5000);
  };

  const start = async (params: AudioEffectsParams = {}) => {
    controller.attach(audio);
    play();
    controller.update(params);
    await settle();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudioContext.instances = [];
    const win = window as any;
    delete win.__liner_audio_context;
    delete win.__liner_media_source_node;
    delete win.__liner_pitch_graph;
    win.AudioContext = FakeAudioContext;
    audio = document.createElement("audio");
    paused = true;
    Object.defineProperty(audio, "paused", { get: () => paused });
    controller = new PitchShifterController();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).AudioContext;
  });

  it("neutral playing keeps only the dry path running", async () => {
    await start();
    expect(measure()).toMatchObject({
      convolvers: 0,
      runningSources: 0,
      delays: 0,
      biquads: 0,
      suspended: false,
    });
  });

  it("neutral paused suspends the context after the fade", async () => {
    await start();
    pause();
    await settle();
    expect(measure()).toMatchObject({
      convolvers: 0,
      runningSources: 0,
      biquads: 0,
      suspended: true,
    });
  });

  it("resumes the context as soon as playback starts again", async () => {
    await start();
    pause();
    await settle();
    play();
    expect(FakeAudioContext.instances[0].state).toBe("running");
  });

  it("reverb on connects only the convolver branch", async () => {
    await start({ isReverbEnabled: true, reverbLevel: 0.35 });
    expect(measure()).toMatchObject({
      convolvers: 1,
      runningSources: 0,
      biquads: 1,
      suspended: false,
    });
  });

  it("pitch on starts the shifter only while needed", async () => {
    await start({ isPitchLinked: false, pitchSemitones: 3 });
    expect(measure()).toMatchObject({
      convolvers: 0,
      runningSources: 12,
      delays: 4,
      biquads: 0,
      suspended: false,
    });
  });

  it("eq on inserts the biquad chain", async () => {
    const bass = EQ_PRESETS.find((preset) => preset.id === "bass")!;
    await start({ isEqEnabled: true, eqGains: bass.gains });
    expect(measure()).toMatchObject({
      convolvers: 0,
      runningSources: 0,
      biquads: 10,
      suspended: false,
    });
  });

  it("tears effects down again when they go back to neutral", async () => {
    const bass = EQ_PRESETS.find((preset) => preset.id === "bass")!;
    await start({
      isReverbEnabled: true,
      reverbLevel: 0.5,
      isPitchLinked: false,
      pitchSemitones: -4,
      isEqEnabled: true,
      eqGains: bass.gains,
    });
    expect(measure()).toMatchObject({
      convolvers: 1,
      runningSources: 12,
      biquads: 11,
    });
    controller.update({});
    await settle();
    expect(measure()).toMatchObject({
      convolvers: 0,
      runningSources: 0,
      delays: 0,
      biquads: 0,
    });
    controller.update({ isPitchLinked: false, pitchSemitones: 2 });
    await settle();
    expect(measure()).toMatchObject({ runningSources: 12, delays: 4 });
  });

  it("keeps a re-enabled effect when toggled back before teardown", async () => {
    await start({ isReverbEnabled: true, reverbLevel: 0.4 });
    controller.update({});
    controller.update({ isReverbEnabled: true, reverbLevel: 0.4 });
    await settle();
    expect(measure().convolvers).toBe(1);
  });

  it("drives the same gains as before when effects are on", async () => {
    const bass = EQ_PRESETS.find((preset) => preset.id === "bass")!;
    await start({
      isReverbEnabled: true,
      reverbLevel: 0.35,
      isPitchLinked: false,
      pitchSemitones: 3,
      isEqEnabled: true,
      eqGains: bass.gains,
    });
    const graph = (window as any).__liner_pitch_graph;
    expect(graph.pitchDryGain.gain.value).toBe(0);
    expect(graph.pitchWetGain.gain.value).toBe(1);
    expect(graph.reverbSendGain.gain.value).toBe(1);
    expect(graph.reverbWetGain.gain.value).toBeCloseTo(0.35);
    expect(graph.convolver.buffer).not.toBeNull();
    expect(
      graph.eqFilters.map((filter: FakeBiquad) => filter.gain.value),
    ).toEqual(bass.gains);
    expect(graph.eqChainGain.gain.value).toBe(1);
    expect(graph.eqBypassGain.gain.value).toBe(0);
  });

  it("lets the reverb tail ring out before suspending", async () => {
    await start({ isReverbEnabled: true, reverbLevel: 0.35 });
    pause();
    await vi.advanceTimersByTimeAsync(1000);
    expect(measure().suspended).toBe(false);
    await settle();
    expect(measure().suspended).toBe(true);
  });

  it("activates loudness normalizer stage and switches dry/wet path", async () => {
    await start({ isNormalizerEnabled: true });
    const graph = (window as any).__liner_pitch_graph;
    expect(graph.normalizerDryGain.gain.value).toBe(0);
    expect(graph.normalizerWetGain.gain.value).toBe(1);

    controller.update({ isNormalizerEnabled: false });
    await settle();
    expect(graph.normalizerDryGain.gain.value).toBe(1);
    expect(graph.normalizerWetGain.gain.value).toBe(0);
  });

  it("activates Dolby Atmos 3D spatial sound with correct preset parameters", async () => {
    await start({ crossfeedMode: "standard" });
    const graph = (window as any).__liner_pitch_graph;
    expect(graph.crossfeedBypassGain.gain.value).toBe(0);
    expect(graph.crossfeedWetGain.gain.value).toBe(1);
    expect(graph.crossLeftDelay.delayTime.value).toBe(0.0004);
    expect(graph.crossLeftFilter.frequency.value).toBe(700);
    expect(graph.surroundLeftDelay.delayTime.value).toBe(0.016);
    expect(graph.elevationFilterLeft.gain.value).toBe(2.5);
    expect(graph.spatialRoomGain.gain.value).toBe(0.18);
    // Verify wet gain is connected to output so audio does not disappear
    expect(graph.crossfeedWetGain.outputs.has(graph.crossfeedOutput)).toBe(true);

    controller.update({ crossfeedMode: "off" });
    await settle();
    expect(graph.crossfeedBypassGain.gain.value).toBe(1);
    expect(graph.crossfeedWetGain.gain.value).toBe(0);
  });

  it("exposes analyser node for frequency visualizers", async () => {
    await start();
    const analyser = controller.getAnalyserNode();
    expect(analyser).not.toBeNull();
  });
});
