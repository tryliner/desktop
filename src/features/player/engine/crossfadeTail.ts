import { fadeOutLevel } from "./transitions/planTransition";

export type FadeClock = "media" | "wall";

interface TailSource {
  el: HTMLAudioElement;
  blobUrl: string | null;
  release: (() => void) | null;
  gain: number;
}

interface Tail extends TailSource {
  timer: ReturnType<typeof setTimeout> | null;
  factor: number;
}

const TICK_MS = 16;
const GAPLESS_GRACE_MS = 500;
const UNKNOWN_END_MS = 2_000;

export class CrossfadeTail {
  private tail: Tail | null = null;

  constructor(
    private readonly volume: () => number,
    private readonly detach: (el: HTMLAudioElement) => void,
  ) {}

  get active(): boolean {
    return this.tail !== null;
  }

  start(
    source: TailSource,
    fadeOutMs: number,
    options: { delayMs?: number; clock?: FadeClock } = {},
  ): void {
    this.finish(0);
    const tail: Tail = { ...source, timer: null, factor: 1 };
    this.tail = tail;
    if (fadeOutMs > 0) {
      this.ramp(fadeOutMs, options.delayMs ?? 0, options.clock ?? "media");
      return;
    }
    tail.el.addEventListener("ended", () => this.finishIf(tail), {
      once: true,
    });
    const left = (tail.el.duration - tail.el.currentTime) * 1000;
    tail.timer = setTimeout(
      () => this.finishIf(tail),
      Number.isFinite(left) ? left + GAPLESS_GRACE_MS : UNKNOWN_END_MS,
    );
  }

  applyVolume(): void {
    const tail = this.tail;
    if (!tail) return;
    const level = this.volume() * tail.gain * tail.factor;
    tail.el.volume = Math.max(0, Math.min(1, level));
  }

  finish(fadeMs = 0): void {
    const tail = this.tail;
    if (!tail) return;
    if (fadeMs > 0 && !tail.el.paused && tail.el.volume > 0.01) {
      this.ramp(fadeMs, 0, "wall");
      return;
    }
    this.tail = null;
    if (tail.timer !== null) clearTimeout(tail.timer);
    try {
      tail.el.pause();
      this.detach(tail.el);
      tail.el.removeAttribute("src");
      tail.el.load();
    } catch {}
    tail.release?.();
    if (tail.blobUrl) URL.revokeObjectURL(tail.blobUrl);
    tail.el.remove();
  }

  private finishIf(tail: Tail): void {
    if (this.tail === tail) this.finish(0);
  }

  private ramp(durationMs: number, delayMs: number, clock: FadeClock): void {
    const tail = this.tail;
    if (!tail) return;
    if (tail.timer !== null) clearTimeout(tail.timer);
    const startFactor = tail.factor;
    const startedAt = performance.now();
    const startedAtMedia = tail.el.currentTime;
    const elapsed = () =>
      clock === "media"
        ? (tail.el.currentTime - startedAtMedia) * 1000
        : performance.now() - startedAt;
    const tick = () => {
      if (this.tail !== tail) return;
      const progress = Math.min(
        1,
        Math.max(0, elapsed() - delayMs) / Math.max(1, durationMs),
      );
      tail.factor = startFactor * fadeOutLevel(progress);
      this.applyVolume();
      if (progress >= 1 || tail.el.ended) {
        this.finish(0);
        return;
      }
      tail.timer = setTimeout(tick, TICK_MS);
    };
    tail.timer = setTimeout(tick, TICK_MS);
  }
}
