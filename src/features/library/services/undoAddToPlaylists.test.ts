import { describe, it, expect, vi } from "vitest";

vi.mock("@/shared/api", () => ({ api: {}, ApiError: Error }));
vi.mock("@/shared/api/clientCatalog", () => ({ clientCatalog: {} }));
vi.mock("../hooks/usePlaylists", () => ({ notifyLibraryChanged: vi.fn() }));

import { undoAddToPlaylists, type AddToPlaylistsDeps } from "./addToPlaylists";

function makeDeps(removeItem: AddToPlaylistsDeps["removeItem"]) {
  const deps: AddToPlaylistsDeps = {
    resolveSnapshot: vi.fn(),
    addSnapshots: vi.fn(),
    addOne: vi.fn(),
    removeItem: vi.fn(removeItem),
    notify: vi.fn(),
  };
  return { deps };
}

describe("undoAddToPlaylists", () => {
  const items = [
    { playlistId: "p1", itemId: "i1", trackId: "a" },
    { playlistId: "p2", itemId: "i2", trackId: "a" },
  ];

  it("deletes exactly the created items and refreshes once", async () => {
    const { deps } = makeDeps(async () => undefined);
    const result = await undoAddToPlaylists(items, deps);
    expect(deps.removeItem).toHaveBeenCalledWith("p1", "i1");
    expect(deps.removeItem).toHaveBeenCalledWith("p2", "i2");
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ removed: 2, failed: [] });
  });

  it("returns the items it could not remove", async () => {
    const { deps } = makeDeps(async (_playlistId, itemId) => {
      if (itemId === "i2") throw new Error("offline");
    });
    const result = await undoAddToPlaylists(items, deps);
    expect(result.removed).toBe(1);
    expect(result.failed).toEqual([items[1]]);
  });
});
