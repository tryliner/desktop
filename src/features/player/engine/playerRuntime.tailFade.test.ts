import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./streamResolver", () => ({ resolvePlaybackStream: vi.fn() }));

import { playerRuntime as maybeRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";

if (!maybeRuntime) throw new Error("player runtime missing");
const playerRuntime = maybeRuntime;

const runtime = {
  finishTail: (fadeMs?: number) => playerRuntime.finishTail(fadeMs),
  get audio() {
    return Reflect.get(playerRuntime, "audio") as HTMLAudioElement;
  },
};

function playing(el: HTMLAudioElement, currentTime = 90, duration = 100) {
  Object.defineProperty(el, "paused", { value: false, configurable: true });
  Object.defineProperty(el, "ended", { value: false, configurable: true });
  Object.defineProperty(el, "currentTime", {
    value: currentTime,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(el, "duration", {
    value: duration,
    configurable: true,
  });
}

function advanceMedia(el: HTMLAudioElement, seconds: number) {
  el.currentTime += seconds;
  vi.advanceTimersByTime(20);
}

describe("crossfade tail timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    usePlayerStore.setState({ volume: 0.8, status: "playing" });
    runtime.finishTail(0);
    const el = runtime.audio;
    el.src = "blob:outgoing";
    el.volume = 0.8;
    playing(el);
  });

  afterEach(() => {
    runtime.finishTail(0);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("follows the song's own clock, so slow playback fades over more time", () => {
    const outgoing = runtime.audio;
    playerRuntime.beginTransition(2000);
    vi.advanceTimersByTime(4000);
    expect(playerRuntime.isTransitioning()).toBe(true);
    advanceMedia(outgoing, 2.1);
    expect(playerRuntime.isTransitioning()).toBe(false);
  });

  it("holds full volume until the delay has passed", () => {
    const outgoing = runtime.audio;
    playerRuntime.beginTransition(1000, { delayMs: 3000 });
    advanceMedia(outgoing, 2.5);
    expect(outgoing.volume).toBeCloseTo(0.8, 5);
    advanceMedia(outgoing, 1.0);
    expect(outgoing.volume).toBeLessThan(0.8);
  });

  it("mutes the fading song when the volume goes to zero", () => {
    const outgoing = runtime.audio;
    playerRuntime.beginTransition(4000);
    advanceMedia(outgoing, 1);
    usePlayerStore.setState({ volume: 0 });
    expect(outgoing.volume).toBe(0);
    advanceMedia(outgoing, 0.5);
    expect(outgoing.volume).toBe(0);
  });
});
