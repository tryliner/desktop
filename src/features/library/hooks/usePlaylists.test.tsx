// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { usePlaylist, usePlaylistsList } from "./usePlaylists";
import { api } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/api", () => ({
  api: {
    readUserPlaylist: vi.fn(),
    listPlaylists: vi.fn(),
  },
  getAuthSession: () => ({ accessToken: "test-token", user: { id: "u1" } }),
  mediaUrl: (url: string) => url,
  toClientTrack: (track: any) => ({
    id: track.id,
    title: track.title,
    artists: "",
    coverUrl: track.cover?.url ?? "",
    durationMs: track.durationMs || 0,
    playCount: 0,
  }),
}));

const playlist = {
  id: "pl1",
  ownerId: "u1",
  title: "Big",
  description: null,
  revision: 3,
  trackCount: 300,
  durationMs: 300000,
  coverUrls: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const owner = { id: "u1", username: "u", displayName: null, avatarUrl: null };

function items(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    addedAt: "2026-01-01T00:00:00.000Z",
    track: {
      id: `t${i}`,
      title: `Song ${i}`,
      artists: [{ id: null, name: "Artist" }],
      durationMs: 1000,
      cover: { url: `https://img/${i % 5}`, width: null, height: null },
    },
  }));
}

// a read of `count` items of a playlist of `total`, as readUserPlaylist answers
function read(count: number, total: number, etag?: string) {
  return {
    notModified: false,
    ...(etag ? { etag } : {}),
    playlist: { ...playlist, trackCount: total, durationMs: total * 1000 },
    owner,
    items: items(count),
    nextCursor: count < total ? "next" : null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe("usePlaylist", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: ReturnType<typeof usePlaylist> | undefined;

  function Probe({ id }: { id: string }) {
    result = usePlaylist(id);
    return null;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    queryCache.delete("playlist:detail:pl1");
    queryCache.delete("playlist:etag:pl1");
    result = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("shows the first page while the full list is still loading, then swaps in the full list", async () => {
    const full = deferred<any>();
    (api.readUserPlaylist as any).mockImplementation(
      (_id: string, options: { limit?: number }) =>
        options.limit ? Promise.resolve(read(100, 300)) : full.promise,
    );

    act(() => root.render(<Probe id="pl1" />));
    await flush();

    expect(api.readUserPlaylist).toHaveBeenCalledWith("pl1", { limit: 100 });
    expect(api.readUserPlaylist).toHaveBeenCalledWith("pl1", {
      etag: undefined,
    });
    expect(result?.isLoading).toBe(false);
    expect(result?.data?.partial).toBe(true);
    expect(result?.data?.tracks).toHaveLength(100);
    expect(result?.data?.trackCount).toBe(300);
    expect(result?.data?.durationMs).toBe(300000);

    await act(async () => {
      full.resolve(read(300, 300, '"pl-pl1-3"'));
    });

    expect(result?.data?.partial).toBeUndefined();
    expect(result?.data?.tracks).toHaveLength(300);
    expect(result?.data?.coverUrls).toEqual([
      "https://img/0",
      "https://img/1",
      "https://img/2",
      "https://img/3",
    ]);
    expect(queryCache.get("playlist:etag:pl1")).toBe('"pl-pl1-3"');
  });

  it("ignores a first page that lands after the full list", async () => {
    const first = deferred<any>();
    (api.readUserPlaylist as any).mockImplementation(
      (_id: string, options: { limit?: number }) =>
        options.limit
          ? first.promise
          : Promise.resolve(read(300, 300, '"pl-pl1-3"')),
    );

    act(() => root.render(<Probe id="pl1" />));
    await flush();
    expect(result?.data?.tracks).toHaveLength(300);

    await act(async () => {
      first.resolve(read(100, 300));
    });
    expect(result?.data?.tracks).toHaveLength(300);
  });

  it("revisits from cache and only revalidates with the stored etag", async () => {
    (api.readUserPlaylist as any).mockResolvedValue(read(3, 3, '"pl-pl1-3"'));
    act(() => root.render(<Probe id="pl1" />));
    await flush();
    act(() => root.unmount());

    vi.clearAllMocks();
    (api.readUserPlaylist as any).mockResolvedValue({ notModified: true });
    root = createRoot(container);
    act(() => root.render(<Probe id="pl1" />));

    expect(result?.isLoading).toBe(false);
    expect(result?.data?.tracks).toHaveLength(3);
    await flush();

    expect(api.readUserPlaylist).toHaveBeenCalledTimes(1);
    expect(api.readUserPlaylist).toHaveBeenCalledWith("pl1", {
      etag: '"pl-pl1-3"',
    });
    expect(result?.data?.tracks).toHaveLength(3);
  });
});

describe("usePlaylistsList", () => {
  it("takes track counts and covers from the list", async () => {
    (api.listPlaylists as any).mockResolvedValue({
      items: [
        {
          ...playlist,
          trackCount: 42,
          coverUrls: ["https://img/a", "https://img/b"],
        },
      ],
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    let state: ReturnType<typeof usePlaylistsList> | undefined;
    function Probe() {
      state = usePlaylistsList();
      return null;
    }

    act(() => root.render(<Probe />));
    await flush();

    expect(state?.data.playlists[0]).toMatchObject({
      trackCount: 42,
      coverUrl: "https://img/a",
      coverUrls: ["https://img/a", "https://img/b"],
    });
    act(() => root.unmount());
  });
});
