import { SCROLL_TIME_OFFSET_MS, scrollTarget } from "./scrollPlan";
import type { ScrollMotion } from "./scrollMotion";
import type { LineLayout } from "./types";

const TIME_JUMP_MS = 500;

export interface ScrollDecision {
  scrollTop: number;
  anchor: number;
}

export class ScrollFollower {
  private committed: number[] = [];
  private pinned: number | null = null;
  private lastTimeMs = Number.NaN;
  private forced = true;

  reset() {
    this.committed = [];
    this.pinned = null;
    this.forced = true;
  }

  decide(
    layouts: LineLayout[],
    timeMs: number,
    viewportHeight: number,
  ): ScrollDecision | null {
    if (layouts.length === 0) return null;
    const scrollTime = timeMs + SCROLL_TIME_OFFSET_MS;
    const jumped =
      Number.isNaN(this.lastTimeMs) ||
      Math.abs(timeMs - this.lastTimeMs) > TIME_JUMP_MS;
    this.lastTimeMs = timeMs;
    const target = scrollTarget(layouts, scrollTime, viewportHeight);
    const entered = target.active.some(
      (index) =>
        !this.committed.includes(index) &&
        scrollTime >= layouts[index].line.startMs,
    );
    const pinnedEnded =
      this.pinned !== null &&
      this.pinned !== target.anchor &&
      (!target.active.includes(this.pinned) ||
        scrollTime >= layouts[this.pinned].line.endMs);
    if (!this.forced && !jumped && !entered && !pinnedEnded) return null;
    this.forced = false;
    this.committed = target.active;
    this.pinned = target.overflows ? target.anchor : null;
    return {
      scrollTop: target.scrollTop,
      anchor: target.active[target.active.length - 1] ?? 0,
    };
  }

  apply(
    motion: ScrollMotion,
    layouts: LineLayout[],
    timeMs: number,
    viewportHeight: number,
    pinnedTop: boolean,
    now: number | null,
  ) {
    const decision = this.decide(layouts, timeMs, viewportHeight);
    if (!decision) return;
    const target = pinnedTop ? 0 : decision.scrollTop;
    if (now === null) motion.jumpTo(target);
    else motion.glideTo(target, decision.anchor, now);
  }
}
