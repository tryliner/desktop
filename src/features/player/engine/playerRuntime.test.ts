import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ resolvePlaybackStream: vi.fn() }));

vi.mock("./streamResolver", () => ({
  resolvePlaybackStream: mocks.resolvePlaybackStream,
}));

import { playerRuntime, PlayerRuntime } from "./playerRuntime";
import { usePlayerStore } from "../store/playerStore";
import { linerDb } from "@/shared/storage";
import type { Track } from "@/shared/types";

const urlStream = {
  url: "https://rr1.googlevideo.com/videoplayback?itag=251",
  mimeType: "audio/webm",
  codec: "opus",
  bitrate: 128000,
  expiresAtMs: null,
};

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
    vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValue(
      pendingPlay as unknown as Promise<void>,
    );
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});

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
    vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValue(
      pendingPlay as unknown as Promise<void>,
    );
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

describe("PlayerRuntime — buffering hiccups don't flash the loading state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePlayerStore.setState({ status: "playing", currentTrack: track, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    const audio = (playerRuntime as unknown as { audio: HTMLAudioElement }).audio;
    Reflect.deleteProperty(audio, "readyState");
    Reflect.deleteProperty(audio, "paused");
  });

  it("a seek inside a loaded track (waiting -> seeked right away) keeps the play state", () => {
    const audio = (playerRuntime as unknown as { audio: HTMLAudioElement }).audio;
    Object.defineProperty(audio, "paused", { value: false, configurable: true });
    Object.defineProperty(audio, "readyState", { value: 4, configurable: true });
    audio.dispatchEvent(new Event("waiting"));
    audio.dispatchEvent(new Event("seeked"));
    vi.advanceTimersByTime(1000);
    expect(usePlayerStore.getState().status).toBe("playing");
  });

  it("a real stall still shows loading once it lasts", () => {
    const audio = (playerRuntime as unknown as { audio: HTMLAudioElement }).audio;
    Object.defineProperty(audio, "paused", { value: false, configurable: true });
    Object.defineProperty(audio, "readyState", { value: 2, configurable: true });
    audio.dispatchEvent(new Event("waiting"));
    vi.advanceTimersByTime(100);
    expect(usePlayerStore.getState().status).toBe("playing");
    vi.advanceTimersByTime(300);
    expect(usePlayerStore.getState().status).toBe("loading");
  });
});

describe("PlayerRuntime audio caching", () => {
  beforeEach(() => {
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(
        (_blob: Blob) => "blob:mock-object-url",
      );
    } else {
      vi.spyOn(globalThis.URL, "createObjectURL").mockReturnValue(
        "blob:mock-object-url",
      );
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, "revokeObjectURL").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mocks.resolvePlaybackStream.mockReset();
  });

  it("plays directly from linerDb cache when audio blob exists without resolving a stream", async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    const sessionSpy = mocks.resolvePlaybackStream;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const mockBlob = new Blob(["fake-opus-data"], { type: "audio/webm" });
    await linerDb.putAudio("cached-track-1", mockBlob, "audio/webm");

    const cachedTrack: Track = {
      ...track,
      id: "cached-track-1",
      title: "Cached Track",
    };

    await playerRuntime!.loadAndPlay(cachedTrack);

    expect(sessionSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe("playing");
  });

  it("fetches, plays, and saves to linerDb on cache miss", async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    const sessionSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new Uint8Array([
          0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0,
        ]),
        {
          status: 206,
          headers: { "content-type": "audio/webm" },
        },
      ),
    );

    const freshTrack: Track = {
      ...track,
      id: "fresh-track-2",
      title: "Fresh Track",
    };

    await playerRuntime!.loadAndPlay(freshTrack);

    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalled();

    await vi.waitFor(async () => {
      const storedAudio = await linerDb.getAudio("fresh-track-2");
      expect(storedAudio?.byteSize).toBe(16);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("preloads audio in the background and enables instant cache-hit play on skip", async () => {
    const sessionSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new Uint8Array([
          0x1a, 0x45, 0xdf, 0xa3, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0,
        ]),
        {
          status: 206,
          headers: { "content-type": "audio/webm" },
        },
      ),
    );

    const nextTrack: Track = {
      ...track,
      id: "next-track-3",
      title: "Next Track",
    };

    await playerRuntime!.preloadTrack(nextTrack);

    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const storedAudio = await linerDb.getAudio("next-track-3");
    expect(storedAudio).not.toBeNull();
    expect(storedAudio?.byteSize).toBe(16);

    sessionSpy.mockClear();
    fetchSpy.mockClear();

    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    await playerRuntime!.loadAndPlay(nextTrack);

    expect(sessionSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe("playing");
  });

  it("evicts corrupt 0-byte audio blob from cache and fetches fresh stream", async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    const sessionSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new Uint8Array([
          0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0,
        ]),
        {
          status: 200,
          headers: { "content-type": "audio/webm" },
        },
      ),
    );

    const emptyBlob = new Blob([], { type: "audio/webm" });
    await linerDb.putAudio("corrupt-track-4", emptyBlob, "audio/webm");

    const corruptTrack: Track = {
      ...track,
      id: "corrupt-track-4",
      title: "Corrupt Track",
    };

    await playerRuntime!.loadAndPlay(corruptTrack);

    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalled();
    expect(usePlayerStore.getState().status).toBe("playing");

    const cachedAfter = await linerDb.getAudio("corrupt-track-4");
    expect(cachedAfter?.byteSize).not.toBe(0);
  });

  it("does not cache partial stream chunks when content-range exceeds downloaded bytes", async () => {
    mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 206,
        headers: {
          "content-type": "audio/webm",
          "content-range": "bytes 0-3/1000000",
        },
      }),
    );

    const partialTrack: Track = {
      ...track,
      id: "partial-track-5",
      title: "Partial Track",
    };

    await playerRuntime!.preloadTrack(partialTrack);

    const stored = await linerDb.getAudio("partial-track-5");
    expect(stored).toBeNull();
  });

  it("drops an unreadable cached file, recovers from the network once and does not cache a dash segment", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const resolveSpy = mocks.resolvePlaybackStream.mockResolvedValue(urlStream);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          new Uint8Array([
            0, 0, 0, 0x18, 0x73, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0,
          ]),
          { status: 206 },
        ),
    );

    const corruptTrack: Track = {
      ...track,
      id: "corrupt-track",
      title: "Corrupt",
    };
    await linerDb.putAudio(
      corruptTrack.id,
      new Blob([new Uint8Array([9, 9, 9])], { type: "audio/webm" }),
      "audio/webm",
    );
    usePlayerStore.setState({ currentTrack: corruptTrack, positionMs: 0 });
    await playerRuntime!.loadAndPlay(corruptTrack);
    expect(resolveSpy).not.toHaveBeenCalled();

    const audio = (playerRuntime as unknown as { audio: HTMLAudioElement })
      .audio;
    Object.defineProperty(audio, "error", {
      value: { code: 4, message: "DEMUXER_ERROR_COULD_NOT_OPEN" },
      configurable: true,
    });
    try {
      audio.dispatchEvent(new Event("error"));
      await vi.waitFor(() => expect(resolveSpy).toHaveBeenCalledTimes(1));
      await vi.waitFor(
        () => expect(usePlayerStore.getState().status).toBe("playing"),
        { timeout: 5000 },
      );
      expect(await linerDb.getAudio(corruptTrack.id)).toBeNull();

      audio.dispatchEvent(new Event("error"));
      await vi.waitFor(() =>
        expect(usePlayerStore.getState().status).toBe("error"),
      );
      expect(resolveSpy).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(audio, "error");
    }
  }, 15_000);
});
