import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/api", () => {
  class ApiError extends Error {
    constructor(public status: number) {
      super(`api ${status}`);
    }
  }
  return { api: {}, ApiError };
});
vi.mock("@/shared/api/clientCatalog", () => ({ clientCatalog: {} }));
vi.mock("../hooks/usePlaylists", () => ({ notifyLibraryChanged: vi.fn() }));

import { ApiError } from "@/shared/api";
import {
  addTracksToPlaylists,
  undoAddToPlaylists,
  rememberRecentPlaylists,
  readRecentPlaylists,
  sortByRecent,
  type AddToPlaylistsDeps,
} from "./addToPlaylists";

function track(id: string) {
  return { id, title: `Song ${id}`, artists: [], durationMs: 1000 };
}

function makeDeps(overrides: Partial<AddToPlaylistsDeps> = {}) {
  let item = 0;
  const deps: AddToPlaylistsDeps = {
    resolveSnapshot: vi.fn(async (id: string) => track(id) as any),
    addSnapshots: vi.fn(async (_playlistId: string, tracks: any[]) => ({
      items: tracks.map((t) => ({
        id: `item-${++item}`,
        track: t,
        position: 0,
        addedAt: "",
      })),
      added: tracks.length,
      rejected: 0,
    })) as any,
    addOne: vi.fn(async (_p: string, trackId: string) => ({
      id: `item-${++item}`,
      track: track(trackId),
      position: 0,
      addedAt: "",
    })) as any,
    removeItem: vi.fn(async () => undefined),
    notify: vi.fn(),
    ...overrides,
  };
  return deps;
}

describe("addTracksToPlaylists", () => {
  beforeEach(() => localStorage.clear());

  it("sends one bulk request per playlist and refreshes the library once", async () => {
    const deps = makeDeps();
    const result = await addTracksToPlaylists(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      ["p1", "p2", "p3"],
      deps,
    );
    expect(deps.addSnapshots).toHaveBeenCalledTimes(3);
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(result.added).toBe(6);
    expect(result.playlistsTouched.sort()).toEqual(["p1", "p2", "p3"]);
    expect(result.items).toHaveLength(6);
  });

  it("dedupes repeated tracks and playlists", async () => {
    const deps = makeDeps();
    await addTracksToPlaylists(
      [
        { id: "a", title: "A" },
        { id: "a", title: "A" },
      ],
      ["p1", "p1"],
      deps,
    );
    expect(deps.addSnapshots).toHaveBeenCalledTimes(1);
    expect((deps.addSnapshots as any).mock.calls[0][1]).toHaveLength(1);
  });

  it("skips local files and reports them", async () => {
    const deps = makeDeps();
    const result = await addTracksToPlaylists(
      [
        { id: "local:abc", title: "File" },
        { id: "a", title: "A" },
      ],
      ["p1"],
      deps,
    );
    expect(result.skippedLocal).toBe(1);
    expect(result.added).toBe(1);
  });

  it("counts server-rejected duplicates as already in, not failures", async () => {
    const deps = makeDeps({
      addSnapshots: vi.fn(async () => ({
        items: [],
        added: 0,
        rejected: 2,
      })) as any,
    });
    const result = await addTracksToPlaylists(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      ["p1"],
      deps,
    );
    expect(result.alreadyIn).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.playlistsTouched).toEqual([]);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("falls back to the single-track endpoint when no snapshot resolves", async () => {
    const deps = makeDeps({
      resolveSnapshot: vi.fn(async () => undefined),
      addOne: vi
        .fn()
        .mockResolvedValueOnce({ id: "item-1", track: track("a") })
        .mockRejectedValueOnce(new (ApiError as any)(409)) as any,
    });
    const result = await addTracksToPlaylists(
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
      ["p1"],
      deps,
    );
    expect(deps.addSnapshots).not.toHaveBeenCalled();
    expect(deps.addOne).toHaveBeenCalledTimes(2);
    expect(result.added).toBe(1);
    expect(result.alreadyIn).toBe(1);
  });

  it("keeps other playlists going when one request fails", async () => {
    const deps = makeDeps({
      addSnapshots: vi.fn(async (playlistId: string, tracks: any[]) => {
        if (playlistId === "broken") throw new Error("boom");
        return {
          items: tracks.map((t, i) => ({ id: `i${i}`, track: t })),
          added: tracks.length,
          rejected: 0,
        };
      }) as any,
    });
    const result = await addTracksToPlaylists(
      [{ id: "a", title: "A" }],
      ["broken", "ok"],
      deps,
    );
    expect(result.failed).toBe(1);
    expect(result.added).toBe(1);
    expect(result.playlistsTouched).toEqual(["ok"]);
  });

  it("undo deletes exactly the created items and refreshes once", async () => {
    const deps = makeDeps();
    await undoAddToPlaylists(
      [
        { playlistId: "p1", itemId: "i1", trackId: "a" },
        { playlistId: "p2", itemId: "i2", trackId: "a" },
      ],
      deps,
    );
    expect(deps.removeItem).toHaveBeenCalledWith("p1", "i1");
    expect(deps.removeItem).toHaveBeenCalledWith("p2", "i2");
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });
});

describe("recent playlists", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the five most recent, newest first, without repeats", () => {
    rememberRecentPlaylists(["a", "b"]);
    rememberRecentPlaylists(["c"]);
    rememberRecentPlaylists(["a", "d", "e", "f"]);
    expect(readRecentPlaylists()).toEqual(["a", "d", "e", "f", "c"]);
  });

  it("survives junk in storage", () => {
    localStorage.setItem("liner_recent_playlists_v1", "{nope");
    expect(readRecentPlaylists()).toEqual([]);
  });

  it("sorts recent ones first and keeps the rest in order", () => {
    const list = ["a", "b", "c", "d"].map((id) => ({ id }));
    expect(sortByRecent(list, ["c", "a"]).map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });
});
