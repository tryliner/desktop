import {
  EQ_BANDS,
  EQ_BAND_Q,
  FLAT_EQ,
  eqPreampDb,
  isEqActive,
} from "./equalizer";
import {
  EBU_R128_NORMALIZER,
  CROSSFEED_PRESETS,
  dbToLinear,
  isCrossfeedActive,
  type CrossfeedMode,
} from "./dsp";

const GRAIN_PERIOD = 0.038;
const NUM_TAPS = 4;
const GRAPH_VERSION = 3;
const BRANCH_TEARDOWN_MS = 200;
const IDLE_SUSPEND_MS = 400;
const REVERB_TAIL_SUSPEND_MS = 3000;

function createHannBuffer(context: AudioContext, period: number): AudioBuffer {
  const length = Math.max(1, Math.floor(period * context.sampleRate));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const p = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    p[i] = Math.pow(Math.sin((Math.PI * i) / length), 2);
  }
  return buffer;
}

function createRampBuffer(
  context: AudioContext,
  period: number,
  rampDown: boolean,
): AudioBuffer {
  const length = Math.max(1, Math.floor(period * context.sampleRate));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const p = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    p[i] = rampDown ? (length - 1 - i) / length : i / length;
  }
  return buffer;
}

class HannPitchShifter {
  private context: AudioContext;
  public input: GainNode;
  public output: GainNode;
  public readonly startTime: number;

  private delays: DelayNode[] = [];
  private tapGains: GainNode[] = [];
  private depthGains: GainNode[] = [];
  private dirGainsUp: GainNode[] = [];
  private dirGainsDown: GainNode[] = [];
  private sources: AudioBufferSourceNode[] = [];

  constructor(context: AudioContext) {
    this.context = context;
    this.input = context.createGain();
    this.output = context.createGain();
    this.output.gain.value = 0.5;

    const hannBuffer = createHannBuffer(context, GRAIN_PERIOD);
    const rampDownBuffer = createRampBuffer(context, GRAIN_PERIOD, true);
    const rampUpBuffer = createRampBuffer(context, GRAIN_PERIOD, false);

    const t0 = context.currentTime + 0.04;
    this.startTime = t0;

    for (let k = 0; k < NUM_TAPS; k++) {
      const delay = context.createDelay(1.0);
      delay.delayTime.value = 0.0;
      this.delays.push(delay);

      const tapGain = context.createGain();
      tapGain.gain.value = 0.0;
      this.tapGains.push(tapGain);

      this.input.connect(delay);
      delay.connect(tapGain);
      tapGain.connect(this.output);

      const hannSource = context.createBufferSource();
      hannSource.buffer = hannBuffer;
      hannSource.loop = true;
      hannSource.connect(tapGain.gain);

      const upSource = context.createBufferSource();
      upSource.buffer = rampDownBuffer;
      upSource.loop = true;

      const downSource = context.createBufferSource();
      downSource.buffer = rampUpBuffer;
      downSource.loop = true;

      const upGain = context.createGain();
      upGain.gain.value = 0.0;
      this.dirGainsUp.push(upGain);

      const downGain = context.createGain();
      downGain.gain.value = 0.0;
      this.dirGainsDown.push(downGain);

      const depthGain = context.createGain();
      depthGain.gain.value = 0.0;
      this.depthGains.push(depthGain);

      upSource.connect(upGain);
      downSource.connect(downGain);
      upGain.connect(depthGain);
      downGain.connect(depthGain);
      depthGain.connect(delay.delayTime);

      const phaseOffset = (k * GRAIN_PERIOD) / NUM_TAPS;
      const startTime = t0 + phaseOffset;
      hannSource.start(startTime);
      upSource.start(startTime);
      downSource.start(startTime);
      this.sources.push(hannSource, upSource, downSource);
    }
  }

  public setPitchOffset(semitones: number): void {
    const now = this.context.currentTime;
    if (Math.abs(semitones) < 0.02) {
      for (let k = 0; k < NUM_TAPS; k++) {
        this.depthGains[k].gain.setTargetAtTime(0, now, 0.012);
      }
      return;
    }

    const mult = Math.pow(2, semitones / 12);
    const shiftUp = semitones > 0;
    const slope = Math.abs(1 - mult);
    const delayDepth = Math.min(0.035, slope * GRAIN_PERIOD);

    for (let k = 0; k < NUM_TAPS; k++) {
      if (shiftUp) {
        this.dirGainsUp[k].gain.setValueAtTime(1, now);
        this.dirGainsDown[k].gain.setValueAtTime(0, now);
      } else {
        this.dirGainsUp[k].gain.setValueAtTime(0, now);
        this.dirGainsDown[k].gain.setValueAtTime(1, now);
      }
      this.depthGains[k].gain.setTargetAtTime(delayDepth, now, 0.012);
    }
  }

  public dispose(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    const nodes: AudioNode[] = [
      this.input,
      this.output,
      ...this.delays,
      ...this.tapGains,
      ...this.depthGains,
      ...this.dirGainsUp,
      ...this.dirGainsDown,
    ];
    for (const node of nodes) node.disconnect();
    this.sources = [];
  }
}

function createReverbImpulseResponse(context: AudioContext): AudioBuffer {
  const duration = 2.8;
  const decay = 2.4;
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * duration);

  const buffer = context.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  let lpL = 0;
  let lpR = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1.0, t / 0.015);
    const env = attack * Math.exp((-2.5 * t) / decay);
    const damping = Math.max(0.15, 0.75 - 0.45 * (t / duration));

    const nL = Math.random() * 2 - 1;
    const nR = Math.random() * 2 - 1;

    lpL += damping * (nL - lpL);
    lpR += damping * (nR - lpR);

    left[i] = lpL * env;
    right[i] = lpR * env;
  }

  let peak = 0;
  for (let i = 0; i < length; i++) {
    const aL = Math.abs(left[i]);
    const aR = Math.abs(right[i]);
    if (aL > peak) peak = aL;
    if (aR > peak) peak = aR;
  }
  if (peak > 0) {
    const norm = 0.95 / peak;
    for (let i = 0; i < length; i++) {
      left[i] *= norm;
      right[i] *= norm;
    }
  }

  return buffer;
}

function createSpatialImpulseResponse(context: AudioContext): AudioBuffer {
  const duration = 0.22;
  const sampleRate = context.sampleRate || 44100;
  const length = Math.floor(sampleRate * duration);

  const buffer = context.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Early reflection taps (ms) mimicking reference Atmos theater acoustics
  const taps = [
    { ms: 14, gainL: 0.70, gainR: 0.40 },
    { ms: 21, gainL: 0.45, gainR: 0.65 },
    { ms: 29, gainL: 0.50, gainR: 0.35 },
    { ms: 38, gainL: 0.30, gainR: 0.45 },
    { ms: 49, gainL: 0.25, gainR: 0.20 },
    { ms: 63, gainL: 0.15, gainR: 0.18 },
  ];

  for (const tap of taps) {
    const idx = Math.floor((tap.ms / 1000) * sampleRate);
    if (idx < length) {
      left[idx] = tap.gainL;
      right[idx] = tap.gainR;
    }
  }

  // Smooth diffuse decay
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-t * 22);
    left[i] += (Math.random() * 2 - 1) * 0.12 * decay;
    right[i] += (Math.random() * 2 - 1) * 0.12 * decay;
  }

  return buffer;
}

type BranchName = "pitch" | "reverb" | "eq" | "normalizer" | "crossfeed";

interface AudioEffectsGraph {
  version: number;
  ctx: AudioContext;
  sourceNode: MediaElementAudioSourceNode;
  pitchDryGain: GainNode;
  pitchWetGain: GainNode;
  pitchStageOutput: GainNode;
  shifter: HannPitchShifter | null;
  masterDryGain: GainNode;
  masterOutputGain: GainNode;
  reverbSendGain: GainNode;
  convolver: ConvolverNode;
  reverbHighpass: BiquadFilterNode;
  reverbWetGain: GainNode;
  reverbConnected: boolean;
  normalizerCompressor: DynamicsCompressorNode;
  normalizerDryGain: GainNode;
  normalizerWetGain: GainNode;
  normalizerOutput: GainNode;
  normalizerConnected: boolean;
  eqPreamp: GainNode;
  eqFilters: BiquadFilterNode[];
  eqChainGain: GainNode;
  eqBypassGain: GainNode;
  eqConnected: boolean;
  crossfeedInput: GainNode;
  crossfeedBypassGain: GainNode;
  crossfeedWetGain: GainNode;
  crossfeedSplitter: ChannelSplitterNode;
  crossfeedMerger: ChannelMergerNode;
  directLeftGain: GainNode;
  directRightGain: GainNode;
  crossLeftDelay: DelayNode;
  crossRightDelay: DelayNode;
  crossLeftFilter: BiquadFilterNode;
  crossRightFilter: BiquadFilterNode;
  crossLeftGain: GainNode;
  crossRightGain: GainNode;
  surroundLeftDelay: DelayNode;
  surroundRightDelay: DelayNode;
  surroundLeftGain: GainNode;
  surroundRightGain: GainNode;
  elevationFilterLeft: BiquadFilterNode;
  elevationFilterRight: BiquadFilterNode;
  spatialConvolver: ConvolverNode;
  spatialRoomGain: GainNode;
  crossfeedOutput: GainNode;
  crossfeedConnected: boolean;
  analyserNode: AnalyserNode;
  teardowns: Record<BranchName, ReturnType<typeof setTimeout> | null>;
}

export interface AudioEffectsParams {
  pitchSemitones?: number;
  isPitchLinked?: boolean;
  isReverbEnabled?: boolean;
  reverbLevel?: number;
  isEqEnabled?: boolean;
  eqGains?: number[];
  isNormalizerEnabled?: boolean;
  crossfeedMode?: CrossfeedMode;
}

function cancelTeardown(graph: AudioEffectsGraph, branch: BranchName): void {
  const timer = graph.teardowns[branch];
  if (timer !== null) {
    clearTimeout(timer);
    graph.teardowns[branch] = null;
  }
}

function scheduleTeardown(
  graph: AudioEffectsGraph,
  branch: BranchName,
  teardown: () => void,
): void {
  if (graph.teardowns[branch] !== null) return;
  graph.teardowns[branch] = setTimeout(() => {
    graph.teardowns[branch] = null;
    try {
      teardown();
    } catch {}
  }, BRANCH_TEARDOWN_MS);
}

function setPitchStage(
  graph: AudioEffectsGraph,
  active: boolean,
  semitones: number,
  now: number,
): void {
  if (active) {
    cancelTeardown(graph, "pitch");
    if (!graph.shifter) {
      const shifter = new HannPitchShifter(graph.ctx);
      graph.sourceNode.connect(graph.pitchWetGain);
      graph.pitchWetGain.connect(shifter.input);
      shifter.output.connect(graph.pitchStageOutput);
      graph.shifter = shifter;
    }
    graph.shifter.setPitchOffset(semitones);
    const at = Math.max(now, graph.shifter.startTime);
    graph.pitchDryGain.gain.setTargetAtTime(0, at, 0.015);
    graph.pitchWetGain.gain.setTargetAtTime(1.0, at, 0.015);
    return;
  }

  graph.pitchDryGain.gain.setTargetAtTime(1.0, now, 0.015);
  graph.pitchWetGain.gain.setTargetAtTime(0, now, 0.015);
  if (!graph.shifter) return;
  graph.shifter.setPitchOffset(0);
  scheduleTeardown(graph, "pitch", () => {
    const shifter = graph.shifter;
    if (!shifter) return;
    graph.shifter = null;
    shifter.dispose();
    graph.sourceNode.disconnect(graph.pitchWetGain);
    graph.pitchWetGain.disconnect();
  });
}

function setReverbStage(
  graph: AudioEffectsGraph,
  wet: number,
  now: number,
): void {
  if (wet > 0) {
    cancelTeardown(graph, "reverb");
    if (!graph.reverbConnected) {
      if (!graph.convolver.buffer) {
        graph.convolver.buffer = createReverbImpulseResponse(graph.ctx);
      }
      graph.reverbWetGain.gain.cancelScheduledValues(now);
      graph.reverbWetGain.gain.setValueAtTime(0, now);
      graph.pitchStageOutput.connect(graph.reverbSendGain);
      graph.reverbWetGain.connect(graph.masterOutputGain);
      graph.reverbConnected = true;
    }
    graph.reverbWetGain.gain.setTargetAtTime(wet, now, 0.02);
    return;
  }

  graph.reverbWetGain.gain.setTargetAtTime(0, now, 0.02);
  if (!graph.reverbConnected) return;
  scheduleTeardown(graph, "reverb", () => {
    if (!graph.reverbConnected) return;
    graph.reverbConnected = false;
    graph.pitchStageOutput.disconnect(graph.reverbSendGain);
    graph.reverbWetGain.disconnect(graph.masterOutputGain);
  });
}

function setNormalizerStage(
  graph: AudioEffectsGraph,
  active: boolean,
  now: number,
): void {
  if (active) {
    cancelTeardown(graph, "normalizer");
    if (!graph.normalizerConnected) {
      try {
        graph.normalizerCompressor.connect(graph.normalizerWetGain);
      } catch {}
      graph.normalizerConnected = true;
    }
    graph.normalizerDryGain.gain.setTargetAtTime(0, now, 0.02);
    graph.normalizerWetGain.gain.setTargetAtTime(1, now, 0.02);
    return;
  }

  graph.normalizerDryGain.gain.setTargetAtTime(1, now, 0.02);
  graph.normalizerWetGain.gain.setTargetAtTime(0, now, 0.02);
  if (!graph.normalizerConnected) return;
  scheduleTeardown(graph, "normalizer", () => {
    if (!graph.normalizerConnected) return;
    graph.normalizerConnected = false;
    try {
      graph.normalizerCompressor.disconnect(graph.normalizerWetGain);
    } catch {}
  });
}

function setCrossfeedStage(
  graph: AudioEffectsGraph,
  mode: CrossfeedMode,
  now: number,
): void {
  const active = isCrossfeedActive(mode);
  if (active) {
    cancelTeardown(graph, "crossfeed");
    const config = CROSSFEED_PRESETS[mode as keyof typeof CROSSFEED_PRESETS];
    const crossGain = dbToLinear(config.crossGainDb);

    if (!graph.crossfeedConnected) {
      try {
        if (!graph.spatialConvolver.buffer) {
          graph.spatialConvolver.buffer = createSpatialImpulseResponse(graph.ctx);
        }
        graph.crossfeedInput.connect(graph.crossfeedSplitter);
        graph.crossfeedMerger.connect(graph.crossfeedWetGain);
      } catch {}
      graph.crossfeedConnected = true;
    }

    graph.crossLeftDelay.delayTime.setTargetAtTime(config.delaySeconds, now, 0.02);
    graph.crossRightDelay.delayTime.setTargetAtTime(config.delaySeconds, now, 0.02);
    graph.crossLeftFilter.frequency.setTargetAtTime(config.cutoffHz, now, 0.02);
    graph.crossRightFilter.frequency.setTargetAtTime(config.cutoffHz, now, 0.02);
    graph.crossLeftGain.gain.setTargetAtTime(crossGain, now, 0.02);
    graph.crossRightGain.gain.setTargetAtTime(crossGain, now, 0.02);

    // Surround Haas decorrelation (side soundstage widening)
    const surroundGain = dbToLinear(config.surroundGainDb);
    graph.surroundLeftDelay.delayTime.setTargetAtTime(config.surroundDelaySeconds, now, 0.02);
    graph.surroundRightDelay.delayTime.setTargetAtTime(config.surroundDelaySeconds * 1.25, now, 0.02);
    graph.surroundLeftGain.gain.setTargetAtTime(surroundGain, now, 0.02);
    graph.surroundRightGain.gain.setTargetAtTime(surroundGain, now, 0.02);

    // Pinna elevation filtering (Atmos height cues)
    graph.elevationFilterLeft.gain.setTargetAtTime(config.elevationGainDb, now, 0.02);
    graph.elevationFilterRight.gain.setTargetAtTime(config.elevationGainDb, now, 0.02);

    // Spatial room early reflections
    graph.spatialRoomGain.gain.setTargetAtTime(config.spatialRoomWet, now, 0.02);

    graph.crossfeedBypassGain.gain.setTargetAtTime(0, now, 0.02);
    graph.crossfeedWetGain.gain.setTargetAtTime(1, now, 0.02);
    return;
  }

  graph.crossfeedBypassGain.gain.setTargetAtTime(1, now, 0.02);
  graph.crossfeedWetGain.gain.setTargetAtTime(0, now, 0.02);
  if (!graph.crossfeedConnected) return;
  scheduleTeardown(graph, "crossfeed", () => {
    if (!graph.crossfeedConnected) return;
    graph.crossfeedConnected = false;
    try {
      graph.crossfeedInput.disconnect(graph.crossfeedSplitter);
      graph.crossfeedMerger.disconnect(graph.crossfeedWetGain);
    } catch {}
  });
}

function setEqStage(
  graph: AudioEffectsGraph,
  active: boolean,
  gains: number[],
  now: number,
): void {
  if (active) {
    cancelTeardown(graph, "eq");
    if (!graph.eqConnected) {
      graph.normalizerOutput.connect(graph.eqPreamp);
      graph.eqChainGain.connect(graph.crossfeedInput);
      graph.eqConnected = true;
    }
  }

  graph.eqFilters.forEach((filter, i) => {
    filter.gain.setTargetAtTime(gains[i] ?? 0, now, 0.02);
  });
  graph.eqPreamp.gain.setTargetAtTime(
    Math.pow(10, eqPreampDb(gains) / 20),
    now,
    0.02,
  );
  graph.eqChainGain.gain.setTargetAtTime(active ? 1 : 0, now, 0.02);
  graph.eqBypassGain.gain.setTargetAtTime(active ? 0 : 1, now, 0.02);

  if (active || !graph.eqConnected) return;
  scheduleTeardown(graph, "eq", () => {
    if (!graph.eqConnected) return;
    graph.eqConnected = false;
    graph.normalizerOutput.disconnect(graph.eqPreamp);
    graph.eqChainGain.disconnect(graph.crossfeedInput);
  });
}

function disposeStaleGraph(graph: any): void {
  try {
    for (const timer of Object.values(graph.teardowns ?? {})) {
      if (timer) clearTimeout(timer as ReturnType<typeof setTimeout>);
    }
    graph.shifter?.dispose?.();
    graph.shifter?.output?.disconnect();
    graph.sourceNode?.disconnect();
    graph.dryGain?.disconnect();
    graph.wetGain?.disconnect();
    graph.outputGain?.disconnect();
    graph.pitchDryGain?.disconnect();
    graph.pitchWetGain?.disconnect();
    graph.pitchStageOutput?.disconnect();
    graph.masterDryGain?.disconnect();
    graph.masterOutputGain?.disconnect();
    graph.reverbSendGain?.disconnect();
    graph.convolver?.disconnect();
    graph.reverbHighpass?.disconnect();
    graph.reverbWetGain?.disconnect();
    graph.normalizerCompressor?.disconnect();
    graph.normalizerDryGain?.disconnect();
    graph.normalizerWetGain?.disconnect();
    graph.normalizerOutput?.disconnect();
    graph.eqPreamp?.disconnect();
    for (const filter of graph.eqFilters ?? []) filter.disconnect();
    graph.eqChainGain?.disconnect();
    graph.eqBypassGain?.disconnect();
    graph.crossfeedInput?.disconnect();
    graph.crossfeedBypassGain?.disconnect();
    graph.crossfeedWetGain?.disconnect();
    graph.crossfeedSplitter?.disconnect();
    graph.crossfeedMerger?.disconnect();
    graph.directLeftGain?.disconnect();
    graph.directRightGain?.disconnect();
    graph.crossLeftDelay?.disconnect();
    graph.crossRightDelay?.disconnect();
    graph.crossLeftFilter?.disconnect();
    graph.crossRightFilter?.disconnect();
    graph.crossLeftGain?.disconnect();
    graph.crossRightGain?.disconnect();
    graph.surroundLeftDelay?.disconnect();
    graph.surroundRightDelay?.disconnect();
    graph.surroundLeftGain?.disconnect();
    graph.surroundRightGain?.disconnect();
    graph.elevationFilterLeft?.disconnect();
    graph.elevationFilterRight?.disconnect();
    graph.spatialConvolver?.disconnect();
    graph.spatialRoomGain?.disconnect();
    graph.crossfeedOutput?.disconnect();
    graph.analyserNode?.disconnect();
  } catch {}
}

function buildGraph(
  ctx: AudioContext,
  sourceNode: MediaElementAudioSourceNode,
): AudioEffectsGraph {
  const pitchDryGain = ctx.createGain();
  const pitchWetGain = ctx.createGain();
  const pitchStageOutput = ctx.createGain();
  const masterDryGain = ctx.createGain();
  const masterOutputGain = ctx.createGain();

  pitchDryGain.gain.value = 1.0;
  pitchWetGain.gain.value = 0.0;
  masterDryGain.gain.value = 1.0;
  masterOutputGain.gain.value = 1.0;

  sourceNode.connect(pitchDryGain);
  pitchDryGain.connect(pitchStageOutput);
  pitchStageOutput.connect(masterDryGain);
  masterDryGain.connect(masterOutputGain);

  const reverbSendGain = ctx.createGain();
  reverbSendGain.gain.value = 1.0;

  const convolver = ctx.createConvolver();
  convolver.normalize = true;

  const reverbHighpass = ctx.createBiquadFilter();
  reverbHighpass.type = "highpass";
  reverbHighpass.frequency.value = 120;
  reverbHighpass.Q.value = 0.7;

  const reverbWetGain = ctx.createGain();
  reverbWetGain.gain.value = 0.0;

  reverbSendGain.connect(convolver);
  convolver.connect(reverbHighpass);
  reverbHighpass.connect(reverbWetGain);

  // Normalizer Stage
  const normalizerCompressor = ctx.createDynamicsCompressor
    ? ctx.createDynamicsCompressor()
    : (ctx.createGain() as any);
  if (normalizerCompressor.threshold) {
    normalizerCompressor.threshold.value = EBU_R128_NORMALIZER.threshold;
    normalizerCompressor.knee.value = EBU_R128_NORMALIZER.knee;
    normalizerCompressor.ratio.value = EBU_R128_NORMALIZER.ratio;
    normalizerCompressor.attack.value = EBU_R128_NORMALIZER.attack;
    normalizerCompressor.release.value = EBU_R128_NORMALIZER.release;
  }
  const normalizerDryGain = ctx.createGain();
  normalizerDryGain.gain.value = 1.0;
  const normalizerWetGain = ctx.createGain();
  normalizerWetGain.gain.value = 0.0;
  const normalizerOutput = ctx.createGain();
  normalizerOutput.gain.value = 1.0;

  masterOutputGain.connect(normalizerDryGain);
  normalizerDryGain.connect(normalizerOutput);
  masterOutputGain.connect(normalizerCompressor);
  normalizerWetGain.connect(normalizerOutput);

  // Equalizer Stage
  const eqPreamp = ctx.createGain();
  eqPreamp.gain.value = 1.0;
  const eqFilters = EQ_BANDS.map((frequency, i) => {
    const filter = ctx.createBiquadFilter();
    filter.type =
      i === 0
        ? "lowshelf"
        : i === EQ_BANDS.length - 1
          ? "highshelf"
          : "peaking";
    filter.frequency.value = frequency;
    filter.Q.value = EQ_BAND_Q;
    filter.gain.value = 0;
    return filter;
  });
  const eqChainGain = ctx.createGain();
  eqChainGain.gain.value = 0.0;
  const eqBypassGain = ctx.createGain();
  eqBypassGain.gain.value = 1.0;

  let eqTail: AudioNode = eqPreamp;
  for (const filter of eqFilters) {
    eqTail.connect(filter);
    eqTail = filter;
  }
  eqTail.connect(eqChainGain);

  // Crossfeed Stage
  const crossfeedInput = ctx.createGain();
  crossfeedInput.gain.value = 1.0;
  const crossfeedBypassGain = ctx.createGain();
  crossfeedBypassGain.gain.value = 1.0;
  const crossfeedWetGain = ctx.createGain();
  crossfeedWetGain.gain.value = 0.0;
  const crossfeedOutput = ctx.createGain();
  crossfeedOutput.gain.value = 1.0;

  normalizerOutput.connect(eqBypassGain);
  eqBypassGain.connect(crossfeedInput);
  crossfeedInput.connect(crossfeedBypassGain);
  crossfeedBypassGain.connect(crossfeedOutput);
  crossfeedWetGain.connect(crossfeedOutput);

  const crossfeedSplitter = ctx.createChannelSplitter
    ? ctx.createChannelSplitter(2)
    : (ctx.createGain() as any);
  const crossfeedMerger = ctx.createChannelMerger
    ? ctx.createChannelMerger(2)
    : (ctx.createGain() as any);

  const directLeftGain = ctx.createGain();
  directLeftGain.gain.value = 1.0;
  const directRightGain = ctx.createGain();
  directRightGain.gain.value = 1.0;

  const crossLeftDelay = ctx.createDelay ? ctx.createDelay(0.01) : (ctx.createGain() as any);
  const crossRightDelay = ctx.createDelay ? ctx.createDelay(0.01) : (ctx.createGain() as any);
  const crossLeftFilter = ctx.createBiquadFilter();
  crossLeftFilter.type = "lowpass";
  const crossRightFilter = ctx.createBiquadFilter();
  crossRightFilter.type = "lowpass";
  const crossLeftGain = ctx.createGain();
  const crossRightGain = ctx.createGain();

  const surroundLeftDelay = ctx.createDelay ? ctx.createDelay(0.05) : (ctx.createGain() as any);
  const surroundRightDelay = ctx.createDelay ? ctx.createDelay(0.05) : (ctx.createGain() as any);
  const surroundLeftGain = ctx.createGain();
  const surroundRightGain = ctx.createGain();

  const elevationFilterLeft = ctx.createBiquadFilter();
  elevationFilterLeft.type = "highshelf";
  elevationFilterLeft.frequency.value = 9500;
  elevationFilterLeft.gain.value = 0;

  const elevationFilterRight = ctx.createBiquadFilter();
  elevationFilterRight.type = "highshelf";
  elevationFilterRight.frequency.value = 9500;
  elevationFilterRight.gain.value = 0;

  const spatialConvolver = ctx.createConvolver ? ctx.createConvolver() : (ctx.createGain() as any);
  if (spatialConvolver.normalize !== undefined) {
    spatialConvolver.normalize = true;
  }
  const spatialRoomGain = ctx.createGain();
  spatialRoomGain.gain.value = 0.0;

  if (crossfeedSplitter.connect && crossfeedMerger.connect) {
    try {
      // Direct paths with pinna elevation
      crossfeedSplitter.connect(directLeftGain, 0);
      directLeftGain.connect(elevationFilterLeft);
      elevationFilterLeft.connect(crossfeedMerger, 0, 0);

      crossfeedSplitter.connect(directRightGain, 1);
      directRightGain.connect(elevationFilterRight);
      elevationFilterRight.connect(crossfeedMerger, 0, 1);

      // Head-shadow cross-ear acoustic diffraction (ITD & ILD)
      crossfeedSplitter.connect(crossLeftDelay, 0);
      crossLeftDelay.connect(crossLeftFilter);
      crossLeftFilter.connect(crossLeftGain);
      crossLeftGain.connect(crossfeedMerger, 0, 1);

      crossfeedSplitter.connect(crossRightDelay, 1);
      crossRightDelay.connect(crossRightFilter);
      crossRightFilter.connect(crossRightGain);
      crossRightGain.connect(crossfeedMerger, 0, 0);

      // Surround Haas decorrelation (side soundstage widening)
      crossfeedSplitter.connect(surroundLeftDelay, 0);
      surroundLeftDelay.connect(surroundLeftGain);
      surroundLeftGain.connect(crossfeedMerger, 0, 1);

      crossfeedSplitter.connect(surroundRightDelay, 1);
      surroundRightDelay.connect(surroundRightGain);
      surroundRightGain.connect(crossfeedMerger, 0, 0);

      // Spatial theater early reflections
      crossfeedSplitter.connect(spatialConvolver);
      spatialConvolver.connect(spatialRoomGain);
      spatialRoomGain.connect(crossfeedMerger, 0, 0);
      spatialRoomGain.connect(crossfeedMerger, 0, 1);
    } catch {}
  }

  // Analyser Node
  const analyserNode = ctx.createAnalyser
    ? ctx.createAnalyser()
    : (ctx.createGain() as any);
  if (analyserNode.fftSize !== undefined) {
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.82;
  }

  crossfeedOutput.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  return {
    version: GRAPH_VERSION,
    ctx,
    sourceNode,
    pitchDryGain,
    pitchWetGain,
    pitchStageOutput,
    shifter: null,
    masterDryGain,
    masterOutputGain,
    reverbSendGain,
    convolver,
    reverbHighpass,
    reverbWetGain,
    reverbConnected: false,
    normalizerCompressor,
    normalizerDryGain,
    normalizerWetGain,
    normalizerOutput,
    normalizerConnected: false,
    eqPreamp,
    eqFilters,
    eqChainGain,
    eqBypassGain,
    eqConnected: false,
    crossfeedInput,
    crossfeedBypassGain,
    crossfeedWetGain,
    crossfeedSplitter,
    crossfeedMerger,
    directLeftGain,
    directRightGain,
    crossLeftDelay,
    crossRightDelay,
    crossLeftFilter,
    crossRightFilter,
    crossLeftGain,
    crossRightGain,
    surroundLeftDelay,
    surroundRightDelay,
    surroundLeftGain,
    surroundRightGain,
    elevationFilterLeft,
    elevationFilterRight,
    spatialConvolver,
    spatialRoomGain,
    crossfeedOutput,
    crossfeedConnected: false,
    analyserNode,
    teardowns: { pitch: null, reverb: null, eq: null, normalizer: null, crossfeed: null },
  };
}

export class PitchShifterController {
  private context: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private graph: AudioEffectsGraph | null = null;
  private audio: HTMLAudioElement | null = null;
  private isConnected = false;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;

  public attach(audio: HTMLAudioElement): void {
    if (typeof window === "undefined") return;
    const win = window as any;

    try {
      const AudioCtx = window.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }

      if (!win.__liner_audio_context) {
        win.__liner_audio_context = new AudioCtx();
      }
      const ctx = win.__liner_audio_context as AudioContext;
      this.context = ctx;

      const audioObj = audio as any;
      let sourceNode = audioObj.__liner_source_node as
        MediaElementAudioSourceNode | undefined;

      if (!sourceNode) {
        if (
          win.__liner_media_source_node &&
          win.__liner_media_source_node.mediaElement === audio
        ) {
          sourceNode = win.__liner_media_source_node;
          audioObj.__liner_source_node = sourceNode;
        } else {
          try {
            sourceNode = ctx.createMediaElementSource(audio);
            audioObj.__liner_source_node = sourceNode;
            win.__liner_media_source_node = sourceNode;
          } catch (sourceErr: any) {
            if (win.__liner_media_source_node) {
              sourceNode = win.__liner_media_source_node;
              audioObj.__liner_source_node = sourceNode;
            } else {
              throw sourceErr;
            }
          }
        }
      }

      if (!sourceNode) {
        return;
      }

      const isCompleteGraph = (g: any): g is AudioEffectsGraph => {
        return Boolean(
          g &&
          g.version === GRAPH_VERSION &&
          g.sourceNode === sourceNode &&
          g.convolver &&
          g.reverbWetGain &&
          g.reverbSendGain &&
          g.pitchStageOutput &&
          g.masterOutputGain &&
          g.masterDryGain &&
          g.normalizerCompressor &&
          g.normalizerOutput &&
          g.eqPreamp &&
          g.eqChainGain &&
          g.eqBypassGain &&
          g.crossfeedOutput &&
          g.analyserNode &&
          g.eqFilters?.length === EQ_BANDS.length,
        );
      };

      let graph = (audioObj.__liner_pitch_graph || win.__liner_pitch_graph) as
        AudioEffectsGraph | undefined;

      if (!isCompleteGraph(graph)) {
        if (graph) disposeStaleGraph(graph);
        delete audioObj.__liner_pitch_graph;
        delete win.__liner_pitch_graph;

        try {
          sourceNode.disconnect();
        } catch {}

        graph = buildGraph(ctx, sourceNode);
        audioObj.__liner_pitch_graph = graph;
        win.__liner_pitch_graph = graph;
      }

      this.context = graph.ctx;
      this.sourceNode = graph.sourceNode;
      this.graph = graph;
      this.audio = audio;
      this.isConnected = true;
      this.bindPlaybackState(audio);
      this.resumeContext();
    } catch (err) {
      console.error("[AudioEffects] Failed to attach to audio element:", err);
      this.isConnected = false;
    }
  }

  public isAttached(): boolean {
    return this.isConnected;
  }

  public resumeContext(): void {
    this.clearSuspendTimer();
    if (this.context && this.context.state === "suspended") {
      void this.context.resume().catch((err) => {
        console.warn("[AudioEffects] AudioContext resume failed:", err);
      });
    }
    if (this.audio?.paused) this.scheduleSuspend();
  }

  private bindPlaybackState(audio: HTMLAudioElement): void {
    const audioObj = audio as any;
    if (audioObj.__liner_effects_owner === this) return;
    const previous = audioObj.__liner_effects_listeners as
      [string, EventListener][] | undefined;
    for (const [type, listener] of previous ?? []) {
      audio.removeEventListener(type, listener);
    }
    const onPlay = () => this.wakeContext();
    const onIdle = () => this.scheduleSuspend();
    const listeners: [string, EventListener][] = [
      ["play", onPlay],
      ["playing", onPlay],
      ["pause", onIdle],
      ["ended", onIdle],
    ];
    for (const [type, listener] of listeners) {
      audio.addEventListener(type, listener);
    }
    audioObj.__liner_effects_listeners = listeners;
    audioObj.__liner_effects_owner = this;
  }

  private wakeContext(): void {
    this.clearSuspendTimer();
    if (this.context && this.context.state === "suspended") {
      void this.context.resume().catch(() => {});
    }
  }

  private clearSuspendTimer(): void {
    if (this.suspendTimer !== null) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
  }

  private scheduleSuspend(): void {
    this.clearSuspendTimer();
    const audio = this.audio;
    const ctx = this.context;
    if (!audio || !ctx || !audio.paused) return;
    const delay = this.graph?.reverbConnected
      ? REVERB_TAIL_SUSPEND_MS
      : IDLE_SUSPEND_MS;
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      if (audio.paused && ctx.state === "running") {
        void ctx.suspend().catch(() => {});
      }
    }, delay);
  }

  public update(
    arg1: number | AudioEffectsParams,
    arg2?: boolean,
    arg3?: boolean,
    arg4?: number,
  ): void {
    if (!this.isConnected || !this.context || !this.graph) {
      if (typeof window !== "undefined") {
        const win = window as any;
        const audio =
          win.__liner_audio ||
          (typeof document !== "undefined" &&
            document.getElementById("liner-audio"));
        if (audio) {
          this.attach(audio);
        }
      }
      if (!this.isConnected || !this.context || !this.graph) {
        return;
      }
    }

    this.resumeContext();

    let semitones = 0;
    let isPitchLinked = true;
    let isReverbEnabled = false;
    let reverbLevel = 0.35;
    let isEqEnabled = false;
    let eqGains = FLAT_EQ;

    let isNormalizerEnabled = false;
    let crossfeedMode: CrossfeedMode = "off";

    if (typeof arg1 === "object" && arg1 !== null) {
      semitones = arg1.pitchSemitones ?? 0;
      isPitchLinked = arg1.isPitchLinked ?? true;
      isReverbEnabled = arg1.isReverbEnabled ?? false;
      reverbLevel = arg1.reverbLevel ?? 0.35;
      isEqEnabled = arg1.isEqEnabled ?? false;
      eqGains = arg1.eqGains ?? FLAT_EQ;
      isNormalizerEnabled = arg1.isNormalizerEnabled ?? false;
      crossfeedMode = arg1.crossfeedMode ?? "off";
    } else {
      semitones = typeof arg1 === "number" ? arg1 : 0;
      isPitchLinked = arg2 ?? true;
      isReverbEnabled = arg3 ?? false;
      reverbLevel = arg4 ?? 0.35;
    }

    const isPitchActive = !isPitchLinked && Math.abs(semitones) >= 0.05;
    const now = this.context.currentTime;

    setPitchStage(this.graph, isPitchActive, semitones, now);

    const reverbWet =
      isReverbEnabled && reverbLevel > 0.01
        ? Math.min(1.2, Math.max(0, reverbLevel))
        : 0;
    setReverbStage(this.graph, reverbWet, now);

    setNormalizerStage(this.graph, isNormalizerEnabled, now);

    const eqActive = isEqActive(isEqEnabled, eqGains);
    setEqStage(this.graph, eqActive, eqActive ? eqGains : FLAT_EQ, now);

    setCrossfeedStage(this.graph, crossfeedMode, now);
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.graph?.analyserNode ?? null;
  }
}

export const pitchShifter = new PitchShifterController();

if (import.meta.hot) {
  import.meta.hot.accept();
}
