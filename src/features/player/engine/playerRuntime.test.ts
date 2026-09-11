import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playerRuntime, PlayerRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";
import type { Track } from "@/shared/types";

const track: Track = {
  id: "t1",
  title: "Track",
  artists: "Artist",
  durationMs: 100_000,
  coverUrl: "",
  playCount: 0,
};

function setAudioPaused(value: boolean) {
  Object.defineProperty((playerRuntime as any).audio, "paused", {
    value,
    configurable: true,
  });
}

describe("PlayerRuntime — status must always match the real audio state", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      status: "idle",
      currentTrack: track,
      queue: [track],
      currentIndex: 0,
      positionMs: 0,
      durationMs: track.durationMs,
      volume: 1,
      error: null,
    });
    (playerRuntime as any).audio.src = "blob:mock-stream";
    setAudioPaused(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a stale resume() play-promise settling after a newer pause() must not restart the fade/playback sequence", async () => {
    const originalFadeVolume = (PlayerRuntime.prototype as any).fadeVolume;
    const fadeSpy = vi
      .spyOn(PlayerRuntime.prototype as any, "fadeVolume")
      .mockImplementation(function (this: unknown, ...args: unknown[]) {
        return originalFadeVolume.apply(this, args);
      });

    let resolvePlay: () => void;
    const pendingPlay = new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValue(pendingPlay as unknown as Promise<void>);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    playerRuntime!.resume();
    expect(usePlayerStore.getState().status).toBe("playing");
    expect(fadeSpy).not.toHaveBeenCalled();

    playerRuntime!.pause();
    expect(usePlayerStore.getState().status).toBe("paused");
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(fadeSpy).toHaveBeenCalledTimes(1);

    resolvePlay!();
    await pendingPlay;
    await Promise.resolve();
    await Promise.resolve();

    expect(fadeSpy).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().status).toBe("paused");
  });

  it("a stale resume() play-promise rejecting after a newer pause() must not touch status either", async () => {
    let rejectPlay: (err: unknown) => void;
    const pendingPlay = new Promise<void>((_resolve, reject) => {
      rejectPlay = reject;
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValue(pendingPlay as unknown as Promise<void>);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    playerRuntime!.resume();
    playerRuntime!.pause();
    expect(usePlayerStore.getState().status).toBe("paused");

    rejectPlay!(new DOMException("aborted", "AbortError"));
    await pendingPlay.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();

    expect(usePlayerStore.getState().status).toBe("paused");
  });
});
