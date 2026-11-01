import { clamp01, fogEasing } from "./easing";

const FOG_TOP = 0.22;
const FOG_BOTTOM = 0.26;
const FOG_TRANSITION_MS = 450;

interface FogTween {
  from: number;
  to: number;
  startedAt: number;
}

function tweenValue(tween: FogTween, now: number): number {
  const progress = clamp01((now - tween.startedAt) / FOG_TRANSITION_MS);
  return tween.from + (tween.to - tween.from) * fogEasing(progress);
}

export class EdgeFog {
  enabled = true;
  private top: FogTween = { from: 0, to: 0, startedAt: 0 };
  private bottom: FogTween = { from: FOG_BOTTOM, to: FOG_BOTTOM, startedAt: 0 };

  private edges = "";

  track(atTop: boolean, atBottom: boolean, now: number): boolean {
    this.update(atTop, atBottom, now);
    const edges = `${atTop}:${atBottom}`;
    if (edges === this.edges) return false;
    this.edges = edges;
    return true;
  }

  update(atTop: boolean, atBottom: boolean, now: number) {
    this.top = this.retarget(this.top, atTop ? 0 : FOG_TOP, now);
    this.bottom = this.retarget(this.bottom, atBottom ? 0 : FOG_BOTTOM, now);
  }

  insets(height: number, now: number) {
    if (!this.enabled) return { top: 0, bottom: 0 };
    return {
      top: tweenValue(this.top, now) * height,
      bottom: tweenValue(this.bottom, now) * height,
    };
  }

  isMoving(now: number): boolean {
    return (
      now - this.top.startedAt < FOG_TRANSITION_MS ||
      now - this.bottom.startedAt < FOG_TRANSITION_MS
    );
  }

  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    now: number,
  ) {
    if (!this.enabled) return;
    const top = tweenValue(this.top, now) * height;
    const bottom = tweenValue(this.bottom, now) * height;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    if (top > 0.5) {
      const gradient = ctx.createLinearGradient(0, 0, 0, top);
      gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, top);
    }
    if (bottom > 0.5) {
      const gradient = ctx.createLinearGradient(0, height - bottom, 0, height);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - bottom, width, bottom);
    }
    ctx.restore();
  }

  private retarget(tween: FogTween, to: number, now: number): FogTween {
    if (tween.to === to) return tween;
    return { from: tweenValue(tween, now), to, startedAt: now };
  }
}
