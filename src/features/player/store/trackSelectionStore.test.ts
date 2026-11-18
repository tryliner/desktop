import { describe, it, expect, beforeEach } from "vitest";
import {
  useTrackSelectionStore,
  selectedTracks,
  type SelectableTrack,
} from "./trackSelectionStore";

const rows: SelectableTrack[] = ["a", "b", "c", "d", "e"].map((id) => ({
  id,
  title: id.toUpperCase(),
  artists: "",
  coverUrl: "",
  durationMs: 0,
}));

const store = () => useTrackSelectionStore.getState();
const ids = () => selectedTracks(store()).map((t) => t.id);

describe("trackSelectionStore", () => {
  beforeEach(() => store().clear());

  it("toggles rows and keeps them in list order", () => {
    store().toggle("list", {}, rows, rows[3]);
    store().toggle("list", {}, rows, rows[1]);
    expect(ids()).toEqual(["b", "d"]);
    store().toggle("list", {}, rows, rows[3]);
    expect(ids()).toEqual(["b"]);
  });

  it("clears entirely when the last row is toggled off", () => {
    store().toggle("list", {}, rows, rows[0]);
    store().toggle("list", {}, rows, rows[0]);
    expect(store().scope).toBeNull();
    expect(store().keys).toEqual([]);
  });

  it("selects a range from the anchor in either direction", () => {
    store().toggle("list", {}, rows, rows[1]);
    store().selectRange("list", {}, rows, rows[3]);
    expect(ids()).toEqual(["b", "c", "d"]);
    store().clear();
    store().toggle("list", {}, rows, rows[4]);
    store().selectRange("list", {}, rows, rows[2]);
    expect(ids()).toEqual(["c", "d", "e"]);
  });

  it("keeps earlier picks when extending a range", () => {
    store().toggle("list", {}, rows, rows[0]);
    store().toggle("list", {}, rows, rows[3]);
    store().selectRange("list", {}, rows, rows[4]);
    expect(ids()).toEqual(["a", "d", "e"]);
  });

  it("starts over when another list is used", () => {
    store().toggle("one", {}, rows, rows[0]);
    store().toggle("two", { playlistId: "p" }, rows, rows[2]);
    expect(store().scope).toBe("two");
    expect(store().meta.playlistId).toBe("p");
    expect(ids()).toEqual(["c"]);
  });

  it("select all takes the whole list", () => {
    store().selectAll("list", {}, rows);
    expect(ids()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("tells repeated tracks apart by playlist item id", () => {
    const dupes: SelectableTrack[] = [
      { ...rows[0], playlistItemId: "i1" },
      { ...rows[0], playlistItemId: "i2" },
    ];
    store().toggle("pl", {}, dupes, dupes[1]);
    expect(store().keys).toEqual(["i2"]);
  });
});
