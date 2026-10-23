import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ resolvePlaybackStream: vi.fn() }));

vi.mock("./streamResolver", () => ({ resolvePlaybackStream: mocks.resolvePlaybackStream }));

import { playerRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";
import type { Track } from "@/shared/types";

const trackA: Track = {
  id: "track-a",
  title: "Track A",
  artists: "Artist A",
  durationMs: 180_000,
  coverUrl: "",
  playCount: 0,
};

const trackB: Track = {
  id: "track-b",
  title: "Track B",
  artists: "Artist B",
  durationMs: 200_000,
  coverUrl: "",
  playCount: 0,
};

describe("Smooth Crossfade Transitions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePlayerStore.setState({
      status: "playing",
      currentTrack: trackA,
      queue: [trackA, trackB],
      currentIndex: 0,
      volume: 0.8,
      crossfadeEnabled: true,
      crossfadeDuration: 5,
    });

    mocks.resolvePlaybackStream.mockResolvedValue({
      url: "https://example.com/audio-b.mp3",
      blob: null,
      mimeType: "audio/mp3",
      expiresAtMs: null,
    });

    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: any) {
      Object.defineProperty(this, "paused", { value: false, configurable: true, writable: true });
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: any) {
      Object.defineProperty(this, "paused", { value: true, configurable: true, writable: true });
    });
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("has crossfade enabled by default with 5 seconds duration", () => {
    const store = usePlayerStore.getState();
    expect(store.crossfadeEnabled).toBe(true);
    expect(store.crossfadeDuration).toBe(5);
  });

  it("updates and clamps crossfade duration correctly between 1s and 12s, ignoring non-finite inputs", () => {
    const store = usePlayerStore.getState();
    store.setCrossfadeDuration(8);
    expect(usePlayerStore.getState().crossfadeDuration).toBe(8);

    store.setCrossfadeDuration(0);
    expect(usePlayerStore.getState().crossfadeDuration).toBe(1);

    store.setCrossfadeDuration(20);
    expect(usePlayerStore.getState().crossfadeDuration).toBe(12);

    store.setCrossfadeDuration(NaN);
    expect(usePlayerStore.getState().crossfadeDuration).toBe(12);

    store.setCrossfadeDuration(Infinity);
    expect(usePlayerStore.getState().crossfadeDuration).toBe(12);

    store.setCrossfadeDuration(-Infinity);
    expect(usePlayerStore.getState().crossfadeDuration).toBe(12);

    store.setCrossfadeEnabled(false);
    expect(usePlayerStore.getState().crossfadeEnabled).toBe(false);
  });

  it("normalizes crossfadeDuration at hydration boundary replacing non-finite values and clamping finite values", () => {
    const onRehydrate = (usePlayerStore.persist.getOptions() as any).onRehydrateStorage?.();

    const stateWithNaN: any = { crossfadeDuration: NaN };
    onRehydrate?.(stateWithNaN);
    expect(stateWithNaN.crossfadeDuration).toBe(5);

    const stateWithInfinity: any = { crossfadeDuration: Infinity };
    onRehydrate?.(stateWithInfinity);
    expect(stateWithInfinity.crossfadeDuration).toBe(5);

    const stateTooHigh: any = { crossfadeDuration: 30 };
    onRehydrate?.(stateTooHigh);
    expect(stateTooHigh.crossfadeDuration).toBe(12);

    const stateTooLow: any = { crossfadeDuration: -5 };
    onRehydrate?.(stateTooLow);
    expect(stateTooLow.crossfadeDuration).toBe(1);
  });

  it("smoothly executes crossfade: fades in incoming deck, fades out outgoing deck and swaps active deck", async () => {
    if (!playerRuntime) return;

    const runtime = playerRuntime as any;
    const initialDeckIndex = runtime.activeDeckIndex;
    const outgoingDeck = runtime.decks[initialDeckIndex];
    const incomingIndex = 1 - initialDeckIndex;
    const incomingDeck = runtime.decks[incomingIndex];

    outgoingDeck.volume = 0.8;
    Object.defineProperty(outgoingDeck, "paused", {
      value: false,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(incomingDeck, "readyState", {
      value: 4,
      configurable: true,
      writable: true,
    });

    let startCalledWith: Track | null = null;
    let completeCalledWith: Track | null = null;
    playerRuntime.getUpcomingTrack = () => trackB;
    playerRuntime.onCrossfadeStart = (track) => {
      startCalledWith = track;
    };
    playerRuntime.onCrossfadeComplete = (track) => {
      completeCalledWith = track;
    };

    const crossfadePromise = playerRuntime.startCrossfade(trackB, 2);

    // Fast-forward initial stream load
    await vi.advanceTimersByTimeAsync(50);

    expect(startCalledWith).toEqual(trackB);
    expect(runtime.isTransitioning).toBe(true);

    // Advance through the crossfade loop (2 seconds)
    await vi.advanceTimersByTimeAsync(2100);
    await crossfadePromise;

    expect(completeCalledWith).toEqual(trackB);
    expect(runtime.isTransitioning).toBe(false);
    expect(runtime.activeDeckIndex).toBe(incomingIndex);
    expect(runtime.currentTrackId).toBe(trackB.id);
    expect(runtime.attachedTrackId).toBe(trackB.id);
    expect(playerRuntime.hasLoadedSourceFor(trackB.id)).toBe(true);
    expect(incomingDeck.volume).toBe(0.8);
    expect(incomingDeck.id).toBe("liner-audio");
    expect(outgoingDeck.id).toBe("liner-audio-b");
    expect((window as any).__liner_audio).toBe(incomingDeck);
  });

  it("aborts crossfade after incomingDeck.play() if epoch changed or getUpcomingTrack changed", async () => {
    if (!playerRuntime) return;

    const runtime = playerRuntime as any;
    const initialDeckIndex = runtime.activeDeckIndex;
    const outgoingDeck = runtime.decks[initialDeckIndex];
    const incomingIndex = 1 - initialDeckIndex;
    const incomingDeck = runtime.decks[incomingIndex];

    outgoingDeck.volume = 0.8;
    Object.defineProperty(outgoingDeck, "paused", {
      value: false,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(incomingDeck, "readyState", {
      value: 4,
      configurable: true,
      writable: true,
    });

    let startCalled = false;
    playerRuntime.onCrossfadeStart = () => {
      startCalled = true;
    };

    // Scenario 1: getUpcomingTrack returns null (queue emptied or changed)
    playerRuntime.getUpcomingTrack = () => null;
    const crossfadePromise1 = playerRuntime.startCrossfade(trackB, 2);
    await vi.advanceTimersByTimeAsync(50);
    await crossfadePromise1;

    expect(startCalled).toBe(false);
    expect(runtime.isTransitioning).toBe(false);
    expect(runtime.activeDeckIndex).toBe(initialDeckIndex);

    // Scenario 2: epoch changes during incomingDeck.play()
    let bumpedEpoch = false;
    vi.spyOn(incomingDeck, "play").mockImplementationOnce(() => {
      runtime.loadEpoch += 1;
      bumpedEpoch = true;
      return Promise.resolve();
    });
    playerRuntime.getUpcomingTrack = () => trackB;

    const crossfadePromise2 = playerRuntime.startCrossfade(trackB, 2);
    await vi.advanceTimersByTimeAsync(50);
    await crossfadePromise2;

    expect(bumpedEpoch).toBe(true);
    expect(startCalled).toBe(false);
    expect(runtime.isTransitioning).toBe(false);
    expect(runtime.activeDeckIndex).toBe(initialDeckIndex);
  });
});
