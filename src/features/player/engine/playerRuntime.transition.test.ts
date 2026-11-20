import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./streamResolver", () => ({ resolvePlaybackStream: vi.fn() }));

import { playerRuntime as maybeRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";

if (!maybeRuntime) throw new Error("player runtime missing");
const playerRuntime = maybeRuntime;

const runtime = playerRuntime;
const audio = () => Reflect.get(playerRuntime, "audio") as HTMLAudioElement;
const setField = (key: string, value: unknown) =>
  Reflect.set(playerRuntime, key, value);
const field = (key: string): unknown => Reflect.get(playerRuntime, key);
const targetVolume = (): number =>
  Reflect.apply(Reflect.get(playerRuntime, "targetVolume"), playerRuntime, []);

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
    const el = audio();
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
    const outgoing = audio();
    setField("activeBlobUrl", "blob:outgoing");
    runtime.beginTransition(3000);

    const fresh = audio();
    expect(fresh).not.toBe(outgoing);
    expect(fresh.id).toBe("liner-audio");
    expect(outgoing.id).toBe("liner-audio-tail");
    expect(document.getElementById("liner-audio")).toBe(fresh);
    expect(Reflect.get(window, "__liner_audio")).toBe(fresh);
    expect(fresh.volume).toBe(0);
    expect(runtime.isTransitioning()).toBe(true);
    expect(field("activeBlobUrl")).toBeNull();
  });

  it("fades the old song out with an equal-power curve, then frees it", () => {
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const outgoing = audio();
    setField("activeBlobUrl", "blob:outgoing");
    runtime.beginTransition(1000, { clock: "wall" });

    vi.advanceTimersByTime(500);
    expect(outgoing.volume).toBeGreaterThan(0.5);
    expect(outgoing.volume).toBeLessThan(0.62);

    vi.advanceTimersByTime(600);
    expect(runtime.isTransitioning()).toBe(false);
    expect(outgoing.isConnected).toBe(false);
    expect(revoke).toHaveBeenCalledWith("blob:outgoing");
  });

  it("lets a gapless handover play the old song out untouched", () => {
    const outgoing = audio();
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
    const outgoing = audio();
    setField("currentTrackId", "a");
    setField("attachedTrackId", "a");
    const dispatch = vi.fn();
    usePlayerStore.setState({ dispatch } as Partial<
      ReturnType<typeof usePlayerStore.getState>
    >);
    runtime.beginTransition(3000);
    playing(outgoing, 100, 100);
    outgoing.dispatchEvent(new Event("ended"));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing when nothing is playing", () => {
    const el = audio();
    Object.defineProperty(el, "paused", { value: true, configurable: true });
    runtime.beginTransition(3000);
    expect(audio()).toBe(el);
    expect(runtime.isTransitioning()).toBe(false);
  });
});

describe("normalize volume", () => {
  it("scales the volume and never goes over the slider", () => {
    usePlayerStore.setState({ volume: 0.5 });
    setField("trackGain", 1);
    runtime.setTrackGain(0.5);
    expect(targetVolume()).toBeCloseTo(0.25);
    runtime.setTrackGain(4);
    expect(targetVolume()).toBeCloseTo(0.5);
    runtime.setTrackGain(1);
  });
});
