import { describe, it, expect, vi } from "vitest";

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

import { ApiError, type ApiUserPlaylistItem } from "@/shared/api";
import type { Track } from "@/shared/contracts";
import {
  addTracksToPlaylists,
  type AddToPlaylistsDeps,
} from "./addToPlaylists";

function track(id: string): Track {
  return { id, title: `Song ${id}`, artists: [], durationMs: 1000 };
}

let itemSeq = 0;
function item(t: Track): ApiUserPlaylistItem {
  return { id: `item-${++itemSeq}`, track: t, position: 0, addedAt: "" };
}

function makeDeps(overrides: Partial<AddToPlaylistsDeps> = {}) {
  const addSnapshots = vi.fn<AddToPlaylistsDeps["addSnapshots"]>(
    async (_playlistId, tracks) => ({
      items: tracks.map((t) => item(track(t.id))),
      added: tracks.length,
      rejected: 0,
    }),
  );
  const deps: AddToPlaylistsDeps = {
    resolveSnapshot: vi.fn(async (id: string) => track(id)),
    addSnapshots,
    addOne: vi.fn<AddToPlaylistsDeps["addOne"]>(async (_p, trackId) =>
      item(track(trackId)),
    ),
    removeItem: vi.fn(async () => undefined),
    listItems: vi.fn(async () => []),
    now: () => Date.parse("2026-11-20T12:00:00Z"),
    notify: vi.fn(),
    ...overrides,
  };
  return { deps, addSnapshots };
}

const ab = [
  { id: "a", title: "A" },
  { id: "b", title: "B" },
];

describe("addTracksToPlaylists", () => {
  it("sends one bulk request per playlist and refreshes once", async () => {
    const { deps } = makeDeps();
    const result = await addTracksToPlaylists(ab, ["p1", "p2", "p3"], deps);
    expect(deps.addSnapshots).toHaveBeenCalledTimes(3);
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(result.added).toBe(6);
    expect(result.playlistsTouched).toEqual(["p1", "p2", "p3"]);
    expect(result.items).toHaveLength(6);
  });

  it("dedupes repeated tracks and playlists", async () => {
    const { deps, addSnapshots } = makeDeps();
    await addTracksToPlaylists([ab[0], ab[0]], ["p1", "p1"], deps);
    expect(addSnapshots).toHaveBeenCalledTimes(1);
    expect(addSnapshots.mock.calls[0][1]).toHaveLength(1);
  });

  it("sends large selections in batches", async () => {
    const { deps, addSnapshots } = makeDeps();
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: `t${i}`,
      title: `T${i}`,
    }));
    const result = await addTracksToPlaylists(many, ["p1"], deps);
    expect(addSnapshots).toHaveBeenCalledTimes(3);
    expect(result.added).toBe(50);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it("skips local files and reports them", async () => {
    const { deps } = makeDeps();
    const result = await addTracksToPlaylists(
      [{ id: "local:abc", title: "File" }, ab[0]],
      ["p1"],
      deps,
    );
    expect(result.skippedLocal).toBe(1);
    expect(result.added).toBe(1);
  });

  it("counts server-rejected duplicates as already in", async () => {
    const { deps } = makeDeps({
      addSnapshots: vi.fn(async () => ({ items: [], added: 0, rejected: 2 })),
    });
    const result = await addTracksToPlaylists(ab, ["p1"], deps);
    expect(result.alreadyIn).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.playlistsTouched).toEqual([]);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("falls back to the single-track endpoint without a snapshot", async () => {
    const { deps } = makeDeps({
      resolveSnapshot: vi.fn(async () => undefined),
      addOne: vi
        .fn<AddToPlaylistsDeps["addOne"]>()
        .mockResolvedValueOnce(item(track("a")))
        .mockRejectedValueOnce(new ApiError(409, "conflict")),
    });
    const result = await addTracksToPlaylists(ab, ["p1"], deps);
    expect(deps.addSnapshots).not.toHaveBeenCalled();
    expect(deps.addOne).toHaveBeenCalledTimes(2);
    expect(result.added).toBe(1);
    expect(result.alreadyIn).toBe(1);
  });

  it("keeps other playlists going when one request fails", async () => {
    const { deps } = makeDeps({
      addSnapshots: vi.fn<AddToPlaylistsDeps["addSnapshots"]>(
        async (playlistId, tracks) => {
          if (playlistId === "broken") throw new Error("boom");
          const items = tracks.map((t) => item(track(t.id)));
          return { items, added: tracks.length, rejected: 0 };
        },
      ),
    });
    const result = await addTracksToPlaylists([ab[0]], ["broken", "ok"], deps);
    expect(result.failed).toBe(1);
    expect(result.added).toBe(1);
    expect(result.playlistsTouched).toEqual(["ok"]);
  });
});
