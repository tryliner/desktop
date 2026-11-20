import { describe, it, expect, vi } from "vitest";
import type { ApiUserPlaylistItem } from "@/shared/api";
import { createdItems } from "./recoverAddedItems";

const NOW = Date.parse("2026-11-20T12:00:00Z");

function item(
  id: string,
  trackId: string,
  addedAt: string,
): ApiUserPlaylistItem {
  return {
    id,
    track: { id: trackId, title: trackId, artists: [], durationMs: 1000 },
    position: 0,
    addedAt,
  };
}

describe("createdItems", () => {
  it("uses the items the server sent back when it sends them", async () => {
    const listItems = vi.fn();
    const sent = [item("i1", "a", "2026-11-20T12:00:01Z")];
    const out = await createdItems(
      { items: sent, added: 1 },
      ["a"],
      NOW,
      listItems,
    );
    expect(out).toBe(sent);
    expect(listItems).not.toHaveBeenCalled();
  });

  it("reads the playlist when the server only sends a count", async () => {
    const listItems = vi.fn(async () => [
      item("old", "x", "2025-01-01T00:00:00Z"),
      item("kept", "a", "2025-01-01T00:00:00Z"),
      item("new", "b", "2026-11-20T12:00:02Z"),
    ]);
    const out = await createdItems(
      { items: [], added: 1 },
      ["a", "b"],
      NOW,
      listItems,
    );
    expect(out.map((i) => i.id)).toEqual(["new"]);
  });

  it("gives up quietly when the playlist can't be read", async () => {
    const out = await createdItems(
      { items: [], added: 2 },
      ["a"],
      NOW,
      async () => {
        throw new Error("offline");
      },
    );
    expect(out).toEqual([]);
  });
});
