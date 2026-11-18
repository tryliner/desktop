import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./streamResolver", () => ({ resolvePlaybackStream: vi.fn() }));

import { playerRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";

const runtime = playerRuntime as any;

function playing(el: HTMLAudioElement, currentTime = 95, duration = 100) {
  Object.defineProperty(el, "paused", { value: false, configurable: true });
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

describe("PlayerRuntime crossfade handover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    usePlayerStore.setState({ volume: 0.8, status: "playing" });
    runtime.finishTail(0);
    const el = runtime.audio as HTMLAudioElement;
    el.src = "blob:outgoing";
    el.volume = 0.8;
    playing(el);
  });

  afterEach(() => {
    runtime.finishTail(0);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("moves playback to a fresh element and keeps the old one playing", () => {
    const outgoing = runtime.audio as HTMLAudioElement;
    runtime.activeBlobUrl = "blob:outgoing";
    runtime.beginTransition(3000);

    const fresh = runtime.audio as HTMLAudioElement;
    expect(fresh).not.toBe(outgoing);
    expect(fresh.id).toBe("liner-audio");
    expect(outgoing.id).toBe("liner-audio-tail");
    expect(document.getElementById("liner-audio")).toBe(fresh);
    expect((window as any).__liner_audio).toBe(fresh);
    expect(fresh.volume).toBe(0);
    expect(runtime.isTransitioning()).toBe(true);
    // the fading song keeps its blob: the next attach must not revoke it
    expect(runtime.activeBlobUrl).toBeNull();
  });

  it("fades the old song out with an equal-power curve, then frees it", () => {
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const outgoing = runtime.audio as HTMLAudioElement;
    runtime.activeBlobUrl = "blob:outgoing";
    runtime.beginTransition(1000);

    vi.advanceTimersByTime(500);
    // cos(pi/4) of the starting 0.8
    expect(outgoing.volume).toBeGreaterThan(0.5);
    expect(outgoing.volume).toBeLessThan(0.62);

    vi.advanceTimersByTime(600);
    expect(runtime.isTransitioning()).toBe(false);
    expect(outgoing.isConnected).toBe(false);
    expect(revoke).toHaveBeenCalledWith("blob:outgoing");
  });

  it("lets a gapless handover play the old song out untouched", () => {
    const outgoing = runtime.audio as HTMLAudioElement;
    playing(outgoing, 99.9, 100);
    runtime.beginTransition(0);
    vi.advanceTimersByTime(50);
    expect(outgoing.volume).toBe(0.8);
    outgoing.dispatchEvent(new Event("ended"));
    expect(runtime.isTransitioning()).toBe(false);
  });

  it("a pause or seek cuts the fade short", () => {
    runtime.beginTransition(8000);
    runtime.seek(1000);
    vi.advanceTimersByTime(200);
    expect(runtime.isTransitioning()).toBe(false);
  });

  it("ignores events from the song that's fading out", () => {
    const outgoing = runtime.audio as HTMLAudioElement;
    runtime.currentTrackId = "a";
    runtime.attachedTrackId = "a";
    const dispatch = vi.fn();
    usePlayerStore.setState({ dispatch } as any);
    runtime.beginTransition(3000);
    playing(outgoing, 100, 100);
    outgoing.dispatchEvent(new Event("ended"));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing when nothing is playing", () => {
    const el = runtime.audio as HTMLAudioElement;
    Object.defineProperty(el, "paused", { value: true, configurable: true });
    runtime.beginTransition(3000);
    expect(runtime.audio).toBe(el);
    expect(runtime.isTransitioning()).toBe(false);
  });
});

describe("normalize volume", () => {
  it("scales the volume and never goes over the slider", () => {
    usePlayerStore.setState({ volume: 0.5 });
    runtime.trackGain = 1;
    runtime.setTrackGain(0.5);
    expect(runtime.targetVolume()).toBeCloseTo(0.25);
    runtime.setTrackGain(4);
    expect(runtime.targetVolume()).toBeCloseTo(0.5);
    runtime.setTrackGain(1);
  });
});
