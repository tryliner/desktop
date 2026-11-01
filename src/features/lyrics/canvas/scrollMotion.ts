import { clamp01, scrollEasing } from "./easing";

const BASE_DURATION_MS = 750;
const MAX_DURATION_MS = 1900;
const WHEEL_SMOOTHING_MS = 70;
const MIN_GLIDE_PX = 2;

interface Glide {
  delta: number;
  startedAt: number;
  anchor: number;
}

export function glideDuration(relativeIndex: number, delta: number): number {
  const distance = Math.abs(relativeIndex);
  const above =
    (relativeIndex < 0 && delta >= 0) || (relativeIndex > 0 && delta < 0);
  if (above) return BASE_DURATION_MS + Math.min(distance, 6) * 20;
  return BASE_DURATION_MS + Math.log(distance + 2) * 80 + (distance + 1) * 20;
}

export class ScrollMotion {
  position = 0;
  private max = 0;
  private glides: Glide[] = [];
  private wheelTarget: number | null = null;

  setMax(max: number) {
    this.max = Math.max(0, max);
    this.position = this.clamp(this.position);
    if (this.wheelTarget !== null)
      this.wheelTarget = this.clamp(this.wheelTarget);
  }

  jumpTo(value: number) {
    this.position = this.clamp(value);
    this.glides = [];
    this.wheelTarget = null;
  }

  glideTo(value: number, anchor: number, now: number) {
    const target = this.clamp(value);
    this.wheelTarget = null;
    const delta = target - this.position;
    if (Math.abs(delta) <= MIN_GLIDE_PX) {
      this.position = target;
      return;
    }
    this.glides.push({ delta, startedAt: now, anchor });
    this.position = target;
  }

  wheel(delta: number) {
    this.wheelTarget = this.clamp((this.wheelTarget ?? this.position) + delta);
  }

  isWheelMoving(): boolean {
    return (
      this.wheelTarget !== null &&
      Math.abs(this.wheelTarget - this.position) >= 0.5
    );
  }

  step(now: number, elapsedMs: number) {
    this.glides = this.glides.filter(
      (glide) => now - glide.startedAt < MAX_DURATION_MS,
    );
    if (this.wheelTarget === null) return;
    const remaining = this.wheelTarget - this.position;
    if (Math.abs(remaining) < 0.5) {
      this.position = this.wheelTarget;
      return;
    }
    const factor = 1 - Math.exp(-elapsedMs / WHEEL_SMOOTHING_MS);
    this.position += remaining * factor;
  }

  offsetFor(index: number, now: number): number {
    let offset = 0;
    for (const glide of this.glides) {
      const progress = clamp01(
        (now - glide.startedAt) /
          glideDuration(index - glide.anchor, glide.delta),
      );
      offset += glide.delta * (1 - scrollEasing(progress));
    }
    return offset;
  }

  isMoving(): boolean {
    return this.glides.length > 0 || this.isWheelMoving();
  }

  atTop(): boolean {
    return this.position <= 4;
  }

  atBottom(): boolean {
    return this.max - this.position <= 4;
  }

  private clamp(value: number): number {
    return Math.min(this.max, Math.max(0, value));
  }
}
