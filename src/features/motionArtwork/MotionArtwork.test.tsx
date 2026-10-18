import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { MotionArtworkCanvas } from "./ui/MotionArtworkCanvas";
import { clearMotionArtworkSessionCache, useMotionArtwork } from "./hooks/useMotionArtwork";
import { useMotionArtworkSettingsStore } from "./store/motionArtworkSettingsStore";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MotionArtworkCanvas", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  it("renders a muted looping video that stays hidden until it can play", () => {
    act(() => {
      root?.render(
        <MotionArtworkCanvas
          resolution={{ videoUrl: "https://cdn.example/canvas.mp4" }}
          isPlaying
        />,
      );
    });
    const video = container?.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.getAttribute("loop")).not.toBeNull();
    expect(video?.getAttribute("playsinline")).not.toBeNull();
    expect(video?.className).toContain("opacity-0");
    expect(video?.src).toBe("https://cdn.example/canvas.mp4");
  });

  it("pauses the video when the track is paused", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();

    act(() => {
      root?.render(
        <MotionArtworkCanvas
          resolution={{ videoUrl: "https://cdn.example/canvas.mp4" }}
          isPlaying
        />,
      );
    });
    const video = container?.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "paused", { value: false });
    vi.spyOn(video, "play").mockImplementation(play);
    vi.spyOn(video, "pause").mockImplementation(pause);

    await act(async () => {
      root?.render(
        <MotionArtworkCanvas
          resolution={{ videoUrl: "https://cdn.example/canvas.mp4" }}
          isPlaying={false}
        />,
      );
    });
    expect(pause).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
});

describe("useMotionArtwork", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    clearMotionArtworkSessionCache();
    useMotionArtworkSettingsStore.getState().setEnabled(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  function Harness({ track }: { track: { title: string; artists: string; albumTitle?: string } | null }) {
    const resolution = useMotionArtwork(track);
    return (
      <div data-testid="out">{resolution ? resolution.videoUrl : "none"}</div>
    );
  }

  it("asks main for a canvas and caches the result for the session", async () => {
    const calls: unknown[] = [];
    (window as { linerElectron: unknown }).linerElectron = {
      getMotionArtwork: (input: unknown) => {
        calls.push(input);
        return Promise.resolve({ videoUrl: "https://cdn.example/canvas.m3u8" });
      },
    };

    act(() => {
      root?.render(
        <Harness track={{ title: "Blinding Lights", artists: "The Weeknd", albumTitle: "After Hours" }} />,
      );
    });
    const out = container?.querySelector('[data-testid="out"]');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(out?.textContent).toBe("https://cdn.example/canvas.m3u8");
    expect(calls).toEqual([
      { title: "Blinding Lights", artist: "The Weeknd", album: "After Hours" },
    ]);

    // fresh mount with the same track -> session cache answers, no new call
    act(() => {
      root?.unmount();
    });
    root = createRoot(container!);
    const callsBefore = calls.length;
    act(() => {
      root?.render(
        <Harness track={{ title: "Blinding Lights", artists: "The Weeknd", albumTitle: "After Hours" }} />,
      );
    });
    expect(container?.querySelector('[data-testid="out"]')?.textContent).toBe(
      "https://cdn.example/canvas.m3u8",
    );
    expect(calls.length).toBe(callsBefore);
  });

  it("stays null when the feature is disabled", () => {
    useMotionArtworkSettingsStore.getState().setEnabled(false);
    (window as { linerElectron: unknown }).linerElectron = {
      getMotionArtwork: () => {
        throw new Error("must not be called");
      },
    };
    act(() => {
      root?.render(
        <Harness track={{ title: "Blinding Lights", artists: "The Weeknd" }} />,
      );
    });
    expect(container?.querySelector('[data-testid="out"]')?.textContent).toBe("none");
  });

  it("stays null when main rejects the lookup", async () => {
    (window as { linerElectron: unknown }).linerElectron = {
      getMotionArtwork: () => Promise.reject(new Error("503")),
    };
    act(() => {
      root?.render(<Harness track={{ title: "Unknown Song", artists: "Unknown Artist" }} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(container?.querySelector('[data-testid="out"]')?.textContent).toBe("none");
  });
});
