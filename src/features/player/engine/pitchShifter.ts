/**
 * Real-time Web Audio Effects Engine for independent pitch control and studio reverb.
 *
 * Pitch Shifting:
 * Uses a 4-tap Hann-windowed granular phase shifter with exact Doppler modulation
 * (s = |1 - 2^(st/12)| * T). Eliminates the comb filtering, 10-Hz motorboating,
 * and brutal metallic phase distortion of primitive 2-tap delay shifters.
 * Automatically switches to 100% bit-perfect dry bypass when pitch is 0 or linked.
 *
 * Reverb:
 * Uses a high-density stereo ConvolverNode with an algorithmic impulse response
 * featuring ~15ms soft rise, decorrelated stereo diffusion, exponential decay,
 * and progressive high-frequency air damping. Filtered with a 120Hz highpass
 * to protect sub-bass/808s.
 * Perfectly tuned for the authentic "Slowed + Reverb" aesthetic.
 */

import {
  EQUALIZER_BANDS,
  sanitizeAudioSettings,
  type AudioSettings,
} from "../store/audioSettings";

const GRAIN_PERIOD = 0.038; // 38ms grain window
const NUM_TAPS = 4;

function createHannBuffer(context: AudioContext, period: number): AudioBuffer {
  const length = Math.max(1, Math.floor(period * context.sampleRate));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const p = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Raised cosine / Hann window (0 at boundaries, peak 1 at center)
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

  private delays: DelayNode[] = [];
  private tapGains: GainNode[] = [];
  private depthGains: GainNode[] = [];
  private dirGainsUp: GainNode[] = [];
  private dirGainsDown: GainNode[] = [];

  constructor(context: AudioContext) {
    this.context = context;
    this.input = context.createGain();
    this.output = context.createGain();
    // Sum of 4 Hann windows staggered by T/4 is identically 2.0 at all times.
    // Multiplying by 0.5 yields exact unity gain (1.0).
    this.output.gain.value = 0.5;

    const hannBuffer = createHannBuffer(context, GRAIN_PERIOD);
    const rampDownBuffer = createRampBuffer(context, GRAIN_PERIOD, true); // Pitch up (delay shrinks)
    const rampUpBuffer = createRampBuffer(context, GRAIN_PERIOD, false); // Pitch down (delay grows)

    const t0 = context.currentTime + 0.04;

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

      // Hann window buffer source
      const hannSource = context.createBufferSource();
      hannSource.buffer = hannBuffer;
      hannSource.loop = true;
      hannSource.connect(tapGain.gain);

      // Delay modulation sources
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
    // Doppler equation: delay modulation depth = slope * grain period
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
}

function createReverbImpulseResponse(context: AudioContext): AudioBuffer {
  const duration = 2.8; // 2.8s lush reverb tail
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
    // 15ms smooth attack prevents clicks, followed by exponential decay
    const attack = Math.min(1.0, t / 0.015);
    const env = attack * Math.exp((-2.5 * t) / decay);

    // Warm high-frequency damping over the course of the tail
    const damping = Math.max(0.15, 0.75 - 0.45 * (t / duration));

    const nL = Math.random() * 2 - 1;
    const nR = Math.random() * 2 - 1;

    lpL += damping * (nL - lpL);
    lpR += damping * (nR - lpR);

    // Stereo decorrelation for a wide, enveloping soundstage
    left[i] = lpL * env;
    right[i] = lpR * env;
  }

  // Normalize peak to 0.95
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

function createHarmonicCurve(amount: number): Float32Array<ArrayBuffer> {
  const sampleCount = 256;
  const curve = new Float32Array(
    new ArrayBuffer(sampleCount * Float32Array.BYTES_PER_ELEMENT),
  );
  const strength = amount * 0.02;
  for (let i = 0; i < sampleCount; i++) {
    const sample = (i * 2) / sampleCount - 1;
    curve[i] = sample - strength * sample ** 3;
  }
  return curve;
}

function clampEnhancementGain(gain: number): number {
  return Math.max(-4, Math.min(4, gain));
}

interface AudioEffectsGraph {
  ctx: AudioContext;
  sourceNode: MediaElementAudioSourceNode;
  pitchDryGain: GainNode;
  pitchWetGain: GainNode;
  pitchStageOutput: GainNode;
  shifter: HannPitchShifter;
  toneHeadroom: GainNode;
  equalizerBands: BiquadFilterNode[];
  hqCompressor: DynamicsCompressorNode;
  hqBass: BiquadFilterNode;
  hqVocal: BiquadFilterNode;
  hqAir: BiquadFilterNode;
  hqSaturation: WaveShaperNode;
  hqLimiter: DynamicsCompressorNode;
  postEnhancement: GainNode;
  masterDryGain: GainNode;
  masterOutputGain: GainNode;
  reverbSendGain: GainNode;
  convolver: ConvolverNode;
  reverbHighpass: BiquadFilterNode;
  reverbWetGain: GainNode;
}

export interface AudioEffectsParams extends Partial<AudioSettings> {
  pitchSemitones?: number;
  isPitchLinked?: boolean;
  isReverbEnabled?: boolean;
  reverbLevel?: number;
}

export class PitchShifterController {
  private context: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private graph: AudioEffectsGraph | null = null;
  private isConnected = false;

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

      if (ctx.state === "suspended") {
        void ctx.resume().catch((err) => {
          console.warn("[AudioEffects] AudioContext resume failed:", err);
        });
      }

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

      // Check if existing graph is valid and has all reverb + pitch nodes
      const isCompleteGraph = (g: any): g is AudioEffectsGraph => {
        return Boolean(
          g &&
          g.sourceNode === sourceNode &&
          g.convolver &&
          g.reverbWetGain &&
          g.reverbSendGain &&
          g.pitchStageOutput &&
          g.masterOutputGain &&
          g.masterDryGain &&
          g.shifter &&
          g.toneHeadroom &&
          Array.isArray(g.equalizerBands) &&
          g.equalizerBands.length === EQUALIZER_BANDS.length &&
          g.hqCompressor &&
          g.hqBass &&
          g.hqVocal &&
          g.hqAir &&
          g.hqSaturation &&
          g.hqLimiter &&
          g.postEnhancement,
        );
      };

      let graph = (audioObj.__liner_pitch_graph || win.__liner_pitch_graph) as
        AudioEffectsGraph | undefined;

      if (!isCompleteGraph(graph)) {
        // Disconnect any legacy/stale nodes from the old graph
        if (graph) {
          try {
            (graph as any).sourceNode?.disconnect();
            (graph as any).dryGain?.disconnect();
            (graph as any).wetGain?.disconnect();
            (graph as any).outputGain?.disconnect();
            (graph as any).pitchDryGain?.disconnect();
            (graph as any).pitchWetGain?.disconnect();
            (graph as any).pitchStageOutput?.disconnect();
            (graph as any).toneHeadroom?.disconnect();
            (graph as any).equalizerBands?.forEach((band: BiquadFilterNode) =>
              band.disconnect(),
            );
            (graph as any).hqCompressor?.disconnect();
            (graph as any).hqBass?.disconnect();
            (graph as any).hqVocal?.disconnect();
            (graph as any).hqAir?.disconnect();
            (graph as any).hqSaturation?.disconnect();
            (graph as any).hqLimiter?.disconnect();
            (graph as any).postEnhancement?.disconnect();
            (graph as any).masterDryGain?.disconnect();
            (graph as any).masterOutputGain?.disconnect();
            (graph as any).reverbSendGain?.disconnect();
            (graph as any).convolver?.disconnect();
            (graph as any).reverbHighpass?.disconnect();
            (graph as any).reverbWetGain?.disconnect();
          } catch {}
        }
        delete audioObj.__liner_pitch_graph;
        delete win.__liner_pitch_graph;

        try {
          sourceNode.disconnect();
        } catch {}

        const pitchDryGain = ctx.createGain();
        const pitchWetGain = ctx.createGain();
        const pitchStageOutput = ctx.createGain();
        const masterDryGain = ctx.createGain();
        const masterOutputGain = ctx.createGain();

        // 100% dry bypass by default
        pitchDryGain.gain.value = 1.0;
        pitchWetGain.gain.value = 0.0;
        masterDryGain.gain.value = 1.0;
        masterOutputGain.gain.value = 1.0;

        const shifter = new HannPitchShifter(ctx);

        // Pitch stage routing
        sourceNode.connect(pitchDryGain);
        sourceNode.connect(pitchWetGain);

        pitchDryGain.connect(pitchStageOutput);
        pitchWetGain.connect(shifter.input);
        shifter.output.connect(pitchStageOutput);

        // The EQ and HQ chain both operate after pitch shifting, so their settings
        // remain live across seeking and track changes.
        const toneHeadroom = ctx.createGain();
        const equalizerBands = EQUALIZER_BANDS.map((band) => {
          const filter = ctx.createBiquadFilter();
          filter.type = "peaking";
          filter.frequency.value = band.frequency;
          filter.Q.value = 1.1;
          filter.gain.value = 0;
          return filter;
        });

        // Riff's MIT-licensed audio engine implements these named engines as
        // local Web Audio profiles (compressor, shelf/peak filters, waveshaper,
        // and limiter); it does not download model weights or run ML inference.
        // Adapted here into the existing shared Liner effects graph.
        const hqCompressor = ctx.createDynamicsCompressor();
        hqCompressor.threshold.value = -12;
        hqCompressor.knee.value = 10;
        hqCompressor.ratio.value = 1;
        hqCompressor.attack.value = 0.01;
        hqCompressor.release.value = 0.1;

        const hqBass = ctx.createBiquadFilter();
        hqBass.type = "lowshelf";
        hqBass.frequency.value = 80;
        const hqVocal = ctx.createBiquadFilter();
        hqVocal.type = "peaking";
        hqVocal.frequency.value = 2500;
        hqVocal.Q.value = 1.2;
        const hqAir = ctx.createBiquadFilter();
        hqAir.type = "highshelf";
        hqAir.frequency.value = 9000;

        const hqSaturation = ctx.createWaveShaper();
        hqSaturation.oversample = "4x";
        hqSaturation.curve = createHarmonicCurve(0);
        const hqLimiter = ctx.createDynamicsCompressor();
        hqLimiter.threshold.value = -1;
        hqLimiter.knee.value = 0;
        hqLimiter.ratio.value = 1;
        hqLimiter.attack.value = 0.005;
        hqLimiter.release.value = 0.05;
        const postEnhancement = ctx.createGain();

        pitchStageOutput.connect(toneHeadroom);
        toneHeadroom.connect(equalizerBands[0]);
        for (let index = 0; index < equalizerBands.length - 1; index++) {
          equalizerBands[index].connect(equalizerBands[index + 1]);
        }
        equalizerBands[equalizerBands.length - 1].connect(hqCompressor);
        hqCompressor.connect(hqBass);
        hqBass.connect(hqVocal);
        hqVocal.connect(hqAir);
        hqAir.connect(hqSaturation);
        hqSaturation.connect(hqLimiter);
        hqLimiter.connect(postEnhancement);
        postEnhancement.connect(masterDryGain);
        masterDryGain.connect(masterOutputGain);

        // Reverb stage routing
        const reverbSendGain = ctx.createGain();
        reverbSendGain.gain.value = 1.0;

        const convolver = ctx.createConvolver();
        convolver.normalize = true;
        convolver.buffer = createReverbImpulseResponse(ctx);

        // Filter out sub-bass mud from reverb (keeps kick/808 tight)
        const reverbHighpass = ctx.createBiquadFilter();
        reverbHighpass.type = "highpass";
        reverbHighpass.frequency.value = 120;
        reverbHighpass.Q.value = 0.7;

        const reverbWetGain = ctx.createGain();
        reverbWetGain.gain.value = 0.0; // Disabled by default

        postEnhancement.connect(reverbSendGain);
        reverbSendGain.connect(convolver);
        convolver.connect(reverbHighpass);
        reverbHighpass.connect(reverbWetGain);
        reverbWetGain.connect(masterOutputGain);

        masterOutputGain.connect(ctx.destination);

        graph = {
          ctx,
          sourceNode,
          pitchDryGain,
          pitchWetGain,
          pitchStageOutput,
          shifter,
          toneHeadroom,
          equalizerBands,
          hqCompressor,
          hqBass,
          hqVocal,
          hqAir,
          hqSaturation,
          hqLimiter,
          postEnhancement,
          masterDryGain,
          masterOutputGain,
          reverbSendGain,
          convolver,
          reverbHighpass,
          reverbWetGain,
        };

        audioObj.__liner_pitch_graph = graph;
        win.__liner_pitch_graph = graph;
      }

      this.context = graph.ctx;
      this.sourceNode = graph.sourceNode;
      this.graph = graph;
      this.isConnected = true;
    } catch (err) {
      console.error("[AudioEffects] Failed to attach to audio element:", err);
      this.isConnected = false;
    }
  }

  public isAttached(): boolean {
    return this.isConnected;
  }

  public resumeContext(): void {
    if (this.context && this.context.state === "suspended") {
      void this.context.resume().catch(() => {});
    }
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

    if (typeof arg1 === "object" && arg1 !== null) {
      semitones = arg1.pitchSemitones ?? 0;
      isPitchLinked = arg1.isPitchLinked ?? true;
      isReverbEnabled = arg1.isReverbEnabled ?? false;
      reverbLevel = arg1.reverbLevel ?? 0.35;
    } else {
      semitones = typeof arg1 === "number" ? arg1 : 0;
      isPitchLinked = arg2 ?? true;
      isReverbEnabled = arg3 ?? false;
      reverbLevel = arg4 ?? 0.35;
    }

    const isPitchActive = !isPitchLinked && Math.abs(semitones) >= 0.05;
    const now = this.context.currentTime;

    const settings = sanitizeAudioSettings(
      (typeof arg1 === "object" ? arg1 : {}) as Partial<AudioSettings> &
        Record<string, unknown>,
    );
    const gains = settings.isEqualizerEnabled
      ? settings.equalizerBands
      : EQUALIZER_BANDS.map(() => 0);
    gains.forEach((gain, index) => {
      this.graph!.equalizerBands[index].gain.setTargetAtTime(
        gain,
        now,
        0.02,
      );
    });

    const enhancementEnabled = settings.isEnhancerEnabled;
    let baseBass = 0;
    let baseAir = 0;
    let saturationAmount = 0.5;
    let compressorRatio = 1.5;
    switch (settings.enhancementEngine) {
      case "glyphs-7B":
        saturationAmount = 0.2;
        baseAir = 2.5;
        this.graph.hqAir.frequency.value = 9000;
        break;
      case "fyro1.1":
        saturationAmount = 0.2;
        baseBass = 3;
        compressorRatio = 2;
        this.graph.hqBass.frequency.value = 80;
        break;
      case "hqmusic-3":
      default:
        saturationAmount = 0.5;
        this.graph.hqBass.frequency.value = 80;
        this.graph.hqAir.frequency.value = 9000;
        break;
    }

    const bassGain = enhancementEnabled
      ? clampEnhancementGain(baseBass + settings.bassDepth * 0.08)
      : 0;
    const vocalGain = enhancementEnabled
      ? clampEnhancementGain(settings.vocalClarity * 0.08)
      : 0;
    const airGain = enhancementEnabled
      ? clampEnhancementGain(baseAir + settings.highEndAir * 0.08)
      : 0;
    this.graph.hqBass.gain.setTargetAtTime(bassGain, now, 0.02);
    this.graph.hqVocal.gain.setTargetAtTime(vocalGain, now, 0.02);
    this.graph.hqAir.gain.setTargetAtTime(airGain, now, 0.02);
    this.graph.hqSaturation.curve = createHarmonicCurve(
      enhancementEnabled ? saturationAmount : 0,
    );

    this.graph.hqCompressor.threshold.value = enhancementEnabled ? -12 : 0;
    this.graph.hqCompressor.knee.value = enhancementEnabled ? 10 : 0;
    this.graph.hqCompressor.ratio.value = enhancementEnabled
      ? compressorRatio
      : 1;
    this.graph.hqCompressor.attack.value = 0.01;
    this.graph.hqCompressor.release.value = 0.1;
    this.graph.hqLimiter.threshold.value = enhancementEnabled ? -1 : 0;
    this.graph.hqLimiter.knee.value = 0;
    this.graph.hqLimiter.ratio.value = enhancementEnabled ? 20 : 1;

    const equalizerBoost = Math.max(
      0,
      ...gains.map((gain, index) =>
        Math.max(0, gain) +
        0.18 *
          (Math.max(0, gains[index - 1] ?? 0) +
            Math.max(0, gains[index + 1] ?? 0)),
      ),
    );
    const enhancementBoost =
      Math.max(0, bassGain) + Math.max(0, vocalGain) + Math.max(0, airGain);
    const boostDb = equalizerBoost + enhancementBoost;
    // Riff's runtime uses a dynamics compressor and limiter in its HQ path. Keep
    // the EQ headroom compensation in front of the full EQ/enhancement chain.
    const toneActive = gains.some((gain) => gain !== 0) || enhancementEnabled;
    const wet = isReverbEnabled ? Math.min(1.2, Math.max(0, reverbLevel)) : 0;
    const headroom = Math.pow(10, -boostDb / 20) / (toneActive ? 1 + wet : 1);
    // Headroom engages faster than boosts and releases more slowly, reducing
    // transient overshoot while sliders move or processing is bypassed.
    const headroomParam = this.graph.toneHeadroom.gain;
    headroomParam.setTargetAtTime(
      headroom,
      now,
      headroom < headroomParam.value ? 0.005 : 0.05,
    );
    // Pitch shift routing
    if (isPitchActive) {
      this.graph.shifter.setPitchOffset(semitones);
      this.graph.pitchDryGain.gain.setTargetAtTime(0, now, 0.015);
      this.graph.pitchWetGain.gain.setTargetAtTime(1.0, now, 0.015);
    } else {
      this.graph.pitchDryGain.gain.setTargetAtTime(1.0, now, 0.015);
      this.graph.pitchWetGain.gain.setTargetAtTime(0, now, 0.015);
      this.graph.shifter.setPitchOffset(0);
    }

    // Reverb routing
    if (isReverbEnabled && reverbLevel > 0.01) {
      // Natural wet scaling
      const targetWet = Math.min(1.2, Math.max(0, reverbLevel));
      this.graph.reverbWetGain.gain.setTargetAtTime(targetWet, now, 0.02);
    } else {
      this.graph.reverbWetGain.gain.setTargetAtTime(0, now, 0.02);
    }
  }
}

export const pitchShifter = new PitchShifterController();

if (import.meta.hot) {
  import.meta.hot.accept();
}
