// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useLikedTracks, applyOptimisticLike } from "./useLikedTracks";
import { api } from "@/shared/api";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/api", () => ({
  api: {
    listLikedTracks: vi.fn(),
  },
  toClientTrack: (track: any) => ({
    id: track.id,
    title: track.title,
    artists: track.artists || "",
    coverUrl: track.coverUrl || "",
    durationMs: track.durationMs || 0,
    playCount: track.playCount || 0,
  }),
}));

describe("useLikedTracks", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("does not flip isLoading to true when library:changed event is dispatched after initial load", async () => {
    (api.listLikedTracks as any).mockResolvedValue({
      items: [
        {
          track: { id: "track-1", title: "Song 1", artists: "Artist 1" },
        },
      ],
      nextCursor: null,
    });

    let hookResult: ReturnType<typeof useLikedTracks> | undefined;

    function TestComponent() {
      hookResult = useLikedTracks();
      return <div>loaded: {(!hookResult.isLoading).toString()}</div>;
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(hookResult?.isLoading).toBe(false);
    expect(hookResult?.data.tracks).toHaveLength(1);

    // Apply optimistic like
    act(() => {
      applyOptimisticLike("track-2");
    });
    expect(hookResult?.data.tracks).toHaveLength(2);
    expect(hookResult?.isLoading).toBe(false);

    // Dispatch library:changed event to simulate background update after liking
    let backgroundPromiseResolve: (value: any) => void;
    const backgroundPromise = new Promise((resolve) => {
      backgroundPromiseResolve = resolve;
    });

    (api.listLikedTracks as any).mockImplementation(() => backgroundPromise);

    await act(async () => {
      window.dispatchEvent(new Event("library:changed"));
    });

    // isLoading MUST REMAIN FALSE during background refetch
    expect(hookResult?.isLoading).toBe(false);

    // Resolve background refetch
    await act(async () => {
      backgroundPromiseResolve!({
        items: [
          { track: { id: "track-1", title: "Song 1", artists: "Artist 1" } },
          { track: { id: "track-2", title: "Song 2", artists: "Artist 2" } },
        ],
        nextCursor: null,
      });
      await Promise.resolve();
    });

    expect(hookResult?.isLoading).toBe(false);
    expect(hookResult?.data.tracks).toHaveLength(2);
  });
});
