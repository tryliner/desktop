import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { useSearchTracks } from "./useSearchTracks";
import { api } from "@/shared/api";
import type { SearchSource } from "@/shared/contracts";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface MockSearchTrack {
  id: string;
  title: string;
  artists?: string[];
  durationMs?: number;
}

vi.mock("@/shared/api", () => ({
  api: {
    search: vi.fn(),
  },
  toClientTrack: (track: MockSearchTrack) => ({
    id: track.id,
    title: track.title,
    artists: track.artists ?? [],
    durationMs: track.durationMs ?? 0,
    coverUrl: "",
    playCount: 0,
  }),
}));

const flushPromises = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

describe("useSearchTracks source switching", () => {
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
    vi.restoreAllMocks();
  });

  it("refetches useSearchTracks when switching source with identical query", async () => {
    vi.mocked(api.search)
      .mockResolvedValueOnce({
        items: [
          { type: "track", id: "yt_track", title: "YouTube Track", artists: [] },
        ],
      } as unknown as Awaited<ReturnType<typeof api.search>>)
      .mockResolvedValueOnce({
        items: [
          { type: "track", id: "sc:track", title: "SoundCloud Track", artists: [] },
        ],
      } as unknown as Awaited<ReturnType<typeof api.search>>);

    let hookResult!: ReturnType<typeof useSearchTracks>;

    function TestComponent({ source }: { source: SearchSource }) {
      hookResult = useSearchTracks("discovery", {
        enabled: true,
        limit: 10,
        debounceMs: 0,
        source,
      });
      return null;
    }

    act(() => {
      root.render(<TestComponent source="youtube" />);
    });
    await flushPromises();

    expect(api.search).toHaveBeenCalledWith(
      "discovery",
      "track",
      "youtube",
      expect.any(AbortSignal),
    );
    expect(hookResult.tracks).toHaveLength(1);
    expect(hookResult.tracks[0].id).toBe("yt_track");

    act(() => {
      root.render(<TestComponent source="soundcloud" />);
    });
    await flushPromises();

    expect(api.search).toHaveBeenCalledWith(
      "discovery",
      "track",
      "soundcloud",
      expect.any(AbortSignal),
    );
    expect(hookResult.tracks).toHaveLength(1);
    expect(hookResult.tracks[0].id).toBe("sc:track");
  });
});
