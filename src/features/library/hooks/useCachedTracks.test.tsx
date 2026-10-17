// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useCachedTracks, useCachedTrackCount, removeCachedTrack } from "./useCachedTracks";
import { linerDb } from "@/shared/storage/linerDb";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/storage/linerDb", () => ({
  linerDb: {
    getAllCachedTracks: vi.fn(),
    deleteCachedTrack: vi.fn(),
  },
}));

describe("useCachedTracks", () => {
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

  it("loads cached tracks and updates count", async () => {
    const mockTracks = [
      {
        id: "track-c-1",
        title: "Offline Song 1",
        artists: "Artist 1",
        coverUrl: "http://cover1.jpg",
        durationMs: 180000,
        playCount: 0,
      },
    ];

    (linerDb.getAllCachedTracks as any).mockResolvedValue(mockTracks);

    let tracksResult: ReturnType<typeof useCachedTracks> | undefined;
    let countResult: ReturnType<typeof useCachedTrackCount> | undefined;

    function TestComponent() {
      tracksResult = useCachedTracks();
      countResult = useCachedTrackCount();
      return <div>count: {countResult.count}</div>;
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(tracksResult?.data.tracks).toEqual(mockTracks);
    expect(tracksResult?.data.total).toBe(1);
    expect(countResult?.count).toBe(1);
  });

  it("refreshes when liner:cache_changed is dispatched", async () => {
    (linerDb.getAllCachedTracks as any).mockResolvedValue([]);

    let tracksResult: ReturnType<typeof useCachedTracks> | undefined;

    function TestComponent() {
      tracksResult = useCachedTracks();
      return <div>loaded: {(!tracksResult.isLoading).toString()}</div>;
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(tracksResult?.data.tracks).toEqual([]);

    // Update mock and dispatch event
    const updated = [
      {
        id: "track-c-2",
        title: "Offline Song 2",
        artists: "Artist 2",
        coverUrl: "",
        durationMs: 200000,
        playCount: 0,
      },
    ];
    (linerDb.getAllCachedTracks as any).mockResolvedValue(updated);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("liner:cache_changed"));
    });

    expect(tracksResult?.data.tracks).toEqual(updated);
  });

  it("calls linerDb.deleteCachedTrack on removeCachedTrack", async () => {
    (linerDb.deleteCachedTrack as any).mockResolvedValue(undefined);
    (linerDb.getAllCachedTracks as any).mockResolvedValue([]);

    await removeCachedTrack("track-delete-1");
    expect(linerDb.deleteCachedTrack).toHaveBeenCalledWith("track-delete-1");
  });
});
