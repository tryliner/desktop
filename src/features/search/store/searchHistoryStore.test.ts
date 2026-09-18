import { describe, it, expect, beforeEach } from "vitest";
import { useSearchHistoryStore } from "./searchHistoryStore";

describe("searchHistoryStore", () => {
  beforeEach(() => {
    useSearchHistoryStore.getState().clearHistory();
  });

  it("starts with empty history", () => {
    expect(useSearchHistoryStore.getState().items).toEqual([]);
  });

  it("adds items to the front of history", () => {
    useSearchHistoryStore.getState().addItem({
      id: "track-1",
      type: "track",
      title: "Track One",
    });

    useSearchHistoryStore.getState().clearHistory();
    useSearchHistoryStore.getState().addItem({
      id: "track-1",
      type: "track",
      title: "Track One",
    });
    useSearchHistoryStore.getState().addItem({
      id: "artist-1",
      type: "artist",
      title: "Artist One",
    });

    const items = useSearchHistoryStore.getState().items;
    expect(items.length).toBe(2);
    expect(items[0].id).toBe("artist-1");
    expect(items[1].id).toBe("track-1");
  });

  it("deduplicates and bumps existing items to the front", () => {
    useSearchHistoryStore.getState().addItem({
      id: "track-1",
      type: "track",
      title: "Track One",
    });
    useSearchHistoryStore.getState().addItem({
      id: "track-2",
      type: "track",
      title: "Track Two",
    });
    useSearchHistoryStore.getState().addItem({
      id: "track-1",
      type: "track",
      title: "Track One Updated",
    });

    const items = useSearchHistoryStore.getState().items;
    expect(items.length).toBe(2);
    expect(items[0].id).toBe("track-1");
    expect(items[0].title).toBe("Track One Updated");
    expect(items[1].id).toBe("track-2");
  });

  it("deduplicates queries case-insensitively", () => {
    useSearchHistoryStore.getState().addItem({
      id: "query:cupsize",
      type: "query",
      title: "CUPSIZE",
    });
    useSearchHistoryStore.getState().addItem({
      id: "query:cupsize",
      type: "query",
      title: "cupsize",
    });

    const items = useSearchHistoryStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].title).toBe("cupsize");
  });

  it("removes individual items", () => {
    useSearchHistoryStore.getState().addItem({
      id: "track-1",
      type: "track",
      title: "Track One",
    });
    useSearchHistoryStore.getState().addItem({
      id: "track-2",
      type: "track",
      title: "Track Two",
    });

    useSearchHistoryStore.getState().removeItem("track-1");

    const items = useSearchHistoryStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].id).toBe("track-2");
  });

  it("clears all items", () => {
    useSearchHistoryStore.getState().addItem({
      id: "track-1",
      type: "track",
      title: "Track One",
    });
    useSearchHistoryStore.getState().clearHistory();

    expect(useSearchHistoryStore.getState().items).toEqual([]);
  });

  it("caps at maximum 30 items", () => {
    for (let i = 0; i < 35; i++) {
      useSearchHistoryStore.getState().addItem({
        id: `track-${i}`,
        type: "track",
        title: `Track ${i}`,
      });
    }

    const items = useSearchHistoryStore.getState().items;
    expect(items.length).toBe(30);
    expect(items[0].id).toBe("track-34");
  });
});
