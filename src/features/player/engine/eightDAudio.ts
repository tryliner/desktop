import { log } from "@/shared/utils/logger";

const ROTATION_SPEED_HZ = 0.15; // How fast it circles
const PAN_WIDTH = 0.8;          // How far left/right
const FADE_TIME_S = 0.05;       // 50ms crossfade to prevent audio clicks

export class EightDAudioEffect {
    private context: AudioContext;
    public input: GainNode;
    public output: GainNode;

    private stereoPanner: StereoPannerNode;
    private dryGain: GainNode;
    private wetGain: GainNode;
    private lfo: OscillatorNode;
    private lfoGain: GainNode;

    constructor(context: AudioContext) {
        this.context = context;
        this.input = this.context.createGain();
        this.output = this.context.createGain();

        this.dryGain = this.context.createGain();
        this.wetGain = this.context.createGain();

        this.stereoPanner = this.context.createStereoPanner();

        const now = this.context.currentTime;
        this.lfo = this.context.createOscillator();
        this.lfo.type = "sine";
        this.lfo.frequency.setValueAtTime(ROTATION_SPEED_HZ, now);

        this.lfoGain = this.context.createGain();
        this.lfoGain.gain.value = PAN_WIDTH;

        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.stereoPanner.pan);
        this.lfo.start();

        this.dryGain.gain.value = 1;
        this.wetGain.gain.value = 0;

        this.input.connect(this.dryGain);
        this.input.connect(this.stereoPanner);

        this.dryGain.connect(this.output);
        this.stereoPanner.connect(this.wetGain);
        this.wetGain.connect(this.output);
    }

    public attach(source: AudioNode, destination: AudioNode) {
        source.connect(this.input);
        this.output.connect(destination);
    }

    public setEnabled(enabled: boolean) {
        const now = this.context.currentTime;
        const endTime = now + FADE_TIME_S;

        this.dryGain.gain.cancelScheduledValues(now);
        this.wetGain.gain.cancelScheduledValues(now);

        this.dryGain.gain.setValueAtTime(this.dryGain.gain.value, now);
        this.wetGain.gain.setValueAtTime(this.wetGain.gain.value, now);

        if (enabled) {
            this.dryGain.gain.linearRampToValueAtTime(0, endTime);
            this.wetGain.gain.linearRampToValueAtTime(1, endTime);
            log("cyan", "8d-audio", "Effect enabled");
        } else {
            this.dryGain.gain.linearRampToValueAtTime(1, endTime);
            this.wetGain.gain.linearRampToValueAtTime(0, endTime);
            log("cyan", "8d-audio", "Effect disabled");
        }
    }

    public destroy() {
        try {
            this.lfo.stop();
            this.input.disconnect();
            this.output.disconnect();
            this.stereoPanner.disconnect();
            this.dryGain.disconnect();
            this.wetGain.disconnect();
            this.lfoGain.disconnect();
        } catch {}
    }
}