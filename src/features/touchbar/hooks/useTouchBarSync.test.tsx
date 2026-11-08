import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Track } from "@/shared/types";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@/features/library/hooks", () => ({
  useIsTrackLiked: () => false,
  useToggleTrackLike: () => vi.fn(),
}));

vi.mock("@/features/lyrics", async () => ({
  useLyricsStore: (await import("@/features/lyrics/store/lyricsStore"))
    .useLyricsStore,
}));

vi.mock("@/features/player/engine/playerEngine", async () => {
  const { usePlayerStore } =
    await import("@/features/player/store/playerStore");
  return {
    playerEngine: {
      subscribe: (listener: () => void) => usePlayerStore.subscribe(listener),
      getSnapshot: () => usePlayerStore.getState(),
      togglePlayPause: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
      skipNext: vi.fn(),
      skipPrevious: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      setShuffle: vi.fn(),
    },
  };
});

import { usePlayerStore } from "@/features/player/store/playerStore";
import { useLyricsStore } from "@/features/lyrics/store/lyricsStore";
import { useTouchBarSync } from "./useTouchBarSync";

const TICK_MS = 250;

function track(id: string): Track {
  return {
    id,
    title: `Title ${id}`,
    artists: "Artist",
    coverUrl: `https://cdn/${id}.jpg`,
    durationMs: 200_000,
    playCount: 0,
  };
}

function lyricLines(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    timeMs: 1_000 + i * 3_000,
    text: `line number ${i} of the song`,
    words: [
      { text: "line ", timeMs: 1_000 + i * 3_000, endMs: 1_500 + i * 3_000 },
      {
        text: `number ${i}`,
        timeMs: 1_500 + i * 3_000,
        endMs: 2_500 + i * 3_000,
      },
    ],
  }));
}

function Probe() {
  useTouchBarSync();
  return null;
}

describe("useTouchBarSync ipc volume", () => {
  let container: HTMLDivElement;
  let root: Root;
  let sent: Array<Record<string, unknown>>;
  let sentBytes: number;
  let rafCalls: number;

  function mount(platform: string) {
    window.linerElectron = {
      platform,
      touchbarUpdateState: (state: Record<string, unknown>) => {
        sent.push(state);
        sentBytes += JSON.stringify(state).length;
      },
      onTouchBarAction: () => () => {},
      onTouchBarRequestSync: () => () => {},
    } as never;
    act(() => {
      root.render(<Probe />);
    });
  }

  function play(ms: number, startMs = 0) {
    for (let t = startMs; t < startMs + ms; t += TICK_MS) {
      act(() => {
        usePlayerStore.getState().setPosition(t);
        vi.advanceTimersByTime(TICK_MS);
      });
    }
  }

  function idle(ms: number) {
    for (let t = 0; t < ms; t += TICK_MS) {
      act(() => {
        vi.advanceTimersByTime(TICK_MS);
      });
    }
  }

  function reset() {
    sent = [];
    sentBytes = 0;
    rafCalls = 0;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    reset();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCalls += 1;
      return setTimeout(() => cb(performance.now()), 16) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    usePlayerStore.setState({
      status: "playing",
      currentTrack: track("a"),
      queue: [track("a"), track("b")],
      currentIndex: 0,
      positionMs: 0,
      durationMs: 200_000,
    });
    useLyricsStore.setState({
      syncedLines: lyricLines(60),
      activeLineIndex: null,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.linerElectron;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("windows: sends almost nothing while playing and nothing while paused", () => {
    mount("win32");
    reset();
    play(10_000);
    const playing = { messages: sent.length, bytes: sentBytes, raf: rafCalls };

    act(() => usePlayerStore.getState().setStatus("paused"));
    reset();
    idle(10_000);
    const paused = { messages: sent.length, bytes: sentBytes, raf: rafCalls };
    process.stdout.write(
      `[perf] touchbar win32 10s playing: ${JSON.stringify(playing)}; paused: ${JSON.stringify(paused)}\n`,
    );

    expect(playing.messages).toBe(0);
    expect(playing.raf).toBe(0);
    expect(paused.messages).toBe(0);
    expect(paused.raf).toBe(0);
  });

  it("windows: keeps the thumbar and sleep blocker fed with status and track", () => {
    mount("win32");
    expect(sent.at(-1)).toMatchObject({
      status: "playing",
      track: { id: "a" },
    });
    reset();
    act(() => usePlayerStore.getState().setStatus("paused"));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ status: "paused", track: { id: "a" } });
    act(() => usePlayerStore.getState().setCurrentTrack(track("b"), 1));
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ status: "paused", track: { id: "b" } });
    act(() => usePlayerStore.getState().setVolume(0.3));
    expect(sent).toHaveLength(2);
  });

  it("macos: lyric lines go out once per track, line changes at a low rate", () => {
    mount("darwin");
    const initialWithLines = sent.filter(
      (s) =>
        Array.isArray(s.syncedLines) && (s.syncedLines as unknown[]).length > 0,
    ).length;
    reset();
    play(10_000);
    const playing = { messages: sent.length, bytes: sentBytes, raf: rafCalls };
    const linesResent = sent.filter(
      (s) =>
        Array.isArray(s.syncedLines) && (s.syncedLines as unknown[]).length > 0,
    ).length;

    act(() => usePlayerStore.getState().setStatus("paused"));
    reset();
    idle(10_000);
    const paused = { messages: sent.length, bytes: sentBytes, raf: rafCalls };
    process.stdout.write(
      `[perf] touchbar darwin 10s playing: ${JSON.stringify(playing)}; paused: ${JSON.stringify(paused)}\n`,
    );

    expect(initialWithLines).toBe(1);
    expect(linesResent).toBe(0);
    expect(playing.raf).toBe(0);
    expect(playing.messages).toBeLessThanOrEqual(6);
    expect(paused.messages).toBe(0);
    expect(paused.raf).toBe(0);
  });

  it("macos: reports the current lyric line", () => {
    mount("darwin");
    play(5_000);
    const last = sent.at(-1) as { activeLyricText?: string; status?: string };
    expect(last.status).toBe("playing");
    expect(last.activeLyricText).toBe("line number 1 of the song");
  });
});
