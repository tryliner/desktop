import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useRecentlyPlayed } from "./useRecentlyPlayed";
import { api } from "@/shared/api";

vi.mock("@/shared/api", () => ({
  api: {
    getHistory: vi.fn(),
  },
  toClientTrack: (track: any) => ({
    id: track.id,
    title: track.title,
    artists: track.artists || "",
    coverUrl: track.coverUrl || "",
    durationMs: track.durationMs || 0,
    playCount: track.playCount || 0,
    album: track.album,
  }),
}));

describe("useRecentlyPlayed", () => {
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

  it("collapses consecutive and non-consecutive tracks from the same album into a single album item", async () => {
    const mockHistoryItems = [
      {
        id: "event-1",
        track: {
          id: "track-3",
          title: "Track Three",
          artists: "The Beatles",
          coverUrl: "https://example.com/abbey-road.jpg",
          album: { id: "album-abbey", title: "Abbey Road" },
        },
        context: { type: "album", id: "album-abbey" },
      },
      {
        id: "event-2",
        track: {
          id: "track-2",
          title: "Track Two",
          artists: "The Beatles",
          coverUrl: "https://example.com/abbey-road.jpg",
          album: { id: "album-abbey", title: "Abbey Road" },
        },
        context: { type: "album", id: "album-abbey" },
      },
      {
        id: "event-3",
        track: {
          id: "track-1",
          title: "Track One",
          artists: "The Beatles",
          coverUrl: "https://example.com/abbey-road.jpg",
          album: { id: "album-abbey", title: "Abbey Road" },
        },
        context: { type: "album", id: "album-abbey" },
      },
      {
        id: "event-4",
        track: {
          id: "standalone-track",
          title: "Standalone Single",
          artists: "Solo Artist",
          coverUrl: "https://example.com/single.jpg",
        },
        context: { type: "search" },
      },
    ];

    (api.getHistory as any).mockResolvedValue({
      items: mockHistoryItems,
      nextCursor: null,
    });

    let hookResult: ReturnType<typeof useRecentlyPlayed> | undefined;

    function TestComponent() {
      hookResult = useRecentlyPlayed(15);
      return <div>loaded: {(!hookResult.isLoading).toString()}</div>;
    }

    await act(async () => {
      root.render(<TestComponent />);
    });

    // Wait for promise resolution
    await act(async () => {
      await Promise.resolve();
    });

    expect(hookResult?.isLoading).toBe(false);
    expect(hookResult?.data).toHaveLength(2);

    // First item should be the collapsed Abbey Road album
    expect(hookResult?.data[0]).toEqual({
      type: "album",
      item: {
        id: "album-abbey",
        title: "Abbey Road",
        artist: "The Beatles",
        coverUrl: "https://example.com/abbey-road.jpg",
        totalTracks: 0,
        albumType: "album",
      },
      playCount: 1,
    });

    // Second item should be the standalone track
    expect(hookResult?.data[1]).toEqual({
      type: "track",
      item: expect.objectContaining({
        id: "standalone-track",
        title: "Standalone Single",
      }),
      playCount: 1,
    });
  });
});
