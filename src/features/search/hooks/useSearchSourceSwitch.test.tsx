// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useSearchAll } from "./useSearchAll";
import { api } from "@/shared/api";
import type { SearchSource } from "@/shared/contracts";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/api", () => ({
  api: {
    search: vi.fn(),
  },
  toClientTrack: (track: any) => ({
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

describe("Search Hooks source switching (7.6)", () => {
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

  it("refetches useSearchAll when switching source with identical query", async () => {
    (api.search as any)
      .mockResolvedValueOnce({
        items: [
          { type: "track", id: "yt_1", title: "YouTube Song", artists: [] },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          { type: "track", id: "sc_1", title: "SoundCloud Song", artists: [] },
        ],
      });

    let hookResult: any = null;

    function TestComponent({ source }: { source: SearchSource }) {
      hookResult = useSearchAll("daft punk", {
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
      "daft punk",
      "all",
      "youtube",
      expect.any(AbortSignal),
    );
    expect(hookResult.items).toHaveLength(1);
    expect(hookResult.items[0].id).toBe("yt_1");

    act(() => {
      root.render(<TestComponent source="soundcloud" />);
    });
    await flushPromises();

    expect(api.search).toHaveBeenCalledWith(
      "daft punk",
      "all",
      "soundcloud",
      expect.any(AbortSignal),
    );
    expect(hookResult.items).toHaveLength(1);
    expect(hookResult.items[0].id).toBe("sc_1");
  });

  it("ignores stale response when earlier source request resolves after newer source request", async () => {
    let resolveYt: any;
    const ytPromise = new Promise((resolve) => {
      resolveYt = resolve;
    });

    (api.search as any)
      .mockImplementationOnce(() => ytPromise)
      .mockResolvedValueOnce({
        items: [
          { type: "track", id: "sc_fast", title: "SoundCloud Fast", artists: [] },
        ],
      });

    let hookResult: any = null;

    function TestComponent({ source }: { source: SearchSource }) {
      hookResult = useSearchAll("daft punk", {
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

    act(() => {
      root.render(<TestComponent source="soundcloud" />);
    });
    await flushPromises();

    expect(hookResult.items).toHaveLength(1);
    expect(hookResult.items[0].id).toBe("sc_fast");

    await act(async () => {
      resolveYt({
        items: [
          { type: "track", id: "yt_slow", title: "YouTube Slow", artists: [] },
        ],
      });
    });
    await flushPromises();

    expect(hookResult.items).toHaveLength(1);
    expect(hookResult.items[0].id).toBe("sc_fast");
  });
});
