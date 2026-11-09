import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Track } from "@/shared/types";

vi.mock("@/features/library/hooks", () => ({
  useIsTrackLiked: () => false,
  useToggleTrackLike: () => vi.fn(),
}));

vi.mock("@/features/covers", () => ({
  useCoverSrc: (url?: string | null) => url ?? null,
}));

vi.mock("@/shared/api", () => ({
  getAuthSession: () => ({ user: { id: "u" } }),
}));

vi.mock("@/features/auth/store/authStore", () => ({
  useAuthStore: (selector: (s: { status: string }) => unknown) =>
    selector({ status: "authenticated" }),
}));

vi.mock("@/shared/ui/Toast", () => ({ showToast: vi.fn() }));

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
    },
  };
});

import { usePlayerStore } from "@/features/player/store/playerStore";
import { useOverlaySync } from "./useOverlaySync";

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

function Probe() {
  useOverlaySync();
  return null;
}

describe("useOverlaySync ipc volume", () => {
  let container: HTMLDivElement;
  let root: Root;
  let sent: Array<Record<string, unknown>>;

  function mount() {
    window.linerElectron = {
      platform: "win32",
      overlayUpdateState: (state: Record<string, unknown>) => {
        sent.push(state);
      },
      onOverlayAction: () => () => {},
      setOverlayAuthenticated: () => {},
      updateOverlaySettings: () => {},
      closeOverlay: () => {},
    } as never;
    act(() => {
      root.render(<Probe />);
    });
  }

  function tick(positionMs: number | null) {
    act(() => {
      if (positionMs !== null)
        usePlayerStore.getState().setPosition(positionMs);
      vi.advanceTimersByTime(TICK_MS);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    usePlayerStore.setState({
      status: "playing",
      currentTrack: track("a"),
      queue: [track("a")],
      currentIndex: 0,
      positionMs: 0,
      durationMs: 200_000,
      playbackRate: 1,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete window.linerElectron;
    vi.useRealTimers();
  });

  it("sends position only on seek, status or track change", () => {
    mount();
    sent = [];
    for (let t = 0; t < 10_000; t += TICK_MS) tick(t);
    const playing = sent.length;

    act(() => usePlayerStore.getState().setStatus("paused"));
    sent = [];
    for (let t = 0; t < 10_000; t += TICK_MS) tick(null);
    const paused = sent.length;
    process.stdout.write(
      `[perf] overlay sync 10s playing: ${playing} messages; paused: ${paused} messages\n`,
    );

    expect(playing).toBe(0);
    expect(paused).toBe(0);
  });

  it("resyncs the overlay on seek, pause and track change with a fresh position", () => {
    mount();
    expect(sent.at(-1)).toMatchObject({ status: "playing", positionMs: 0 });
    for (let t = 0; t < 2_000; t += TICK_MS) tick(t);
    sent = [];

    tick(60_000);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ positionMs: 60_000, status: "playing" });
    expect(typeof sent[0].positionAt).toBe("number");

    act(() => {
      usePlayerStore.getState().setPosition(60_400);
      usePlayerStore.getState().setStatus("paused");
    });
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ positionMs: 60_400, status: "paused" });

    act(() => usePlayerStore.getState().setPosition(30_000));
    expect(sent).toHaveLength(3);
    expect(sent[2]).toMatchObject({ positionMs: 30_000, status: "paused" });

    act(() => usePlayerStore.getState().setCurrentTrack(track("b"), 1));
    expect(sent.at(-1)).toMatchObject({ positionMs: 0, track: { id: "b" } });
  });

  it("treats a speed change as a resync point", () => {
    mount();
    sent = [];
    for (let t = 0; t < 2_000; t += TICK_MS) tick(t);
    act(() => usePlayerStore.getState().setPlaybackRate(1.5));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ playbackRate: 1.5 });
    sent = [];
    for (let t = 2_000; t < 8_000; t += TICK_MS * 1.5) tick(Math.round(t));
    expect(sent).toHaveLength(0);
  });
});
