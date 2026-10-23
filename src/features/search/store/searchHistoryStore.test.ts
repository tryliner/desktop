import { describe, it, expect, beforeEach } from "vitest";
import { queryHistoryId, useSearchHistoryStore } from "./searchHistoryStore";
import { clearSearchAndQueryCache } from "@/shared/utils/cacheManager";
import { debouncedStorage } from "@/shared/utils/storage";

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

  it("keeps the same query once per source", () => {
    useSearchHistoryStore.getState().addItem({
      id: queryHistoryId("weeknd", "youtube"),
      type: "query",
      title: "weeknd",
      source: "youtube",
    });
    useSearchHistoryStore.getState().addItem({
      id: queryHistoryId("weeknd", "soundcloud"),
      type: "query",
      title: "weeknd",
      source: "soundcloud",
    });

    expect(useSearchHistoryStore.getState().items).toHaveLength(2);
  });

  it("deduplicates the same query within one source case-insensitively", () => {
    useSearchHistoryStore.getState().addItem({
      id: queryHistoryId("WEEKND", "youtube"),
      type: "query",
      title: "WEEKND",
      source: "youtube",
    });
    useSearchHistoryStore.getState().addItem({
      id: queryHistoryId("weeknd", "youtube"),
      type: "query",
      title: "weeknd",
      source: "youtube",
    });

    const items = useSearchHistoryStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "weeknd", source: "youtube" });
  });

  it("treats a legacy query without source as all", () => {
    useSearchHistoryStore.setState({
      items: [{ id: "query:weeknd", type: "query", title: "WEEKND", timestamp: 1 }],
    });

    useSearchHistoryStore.getState().addItem({
      id: queryHistoryId("weeknd", "all"),
      type: "query",
      title: "weeknd",
      source: "all",
    });

    expect(useSearchHistoryStore.getState().items).toHaveLength(1);
    expect(useSearchHistoryStore.getState().items[0]?.source).toBe("all");
  });

  it("builds stable source-aware query IDs", () => {
    expect(queryHistoryId("  The Weeknd  ", "youtube")).toBe("query:youtube:the weeknd");
    expect(queryHistoryId("THE WEEKND", "soundcloud")).toBe("query:soundcloud:the weeknd");
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

  it("clears search history from both in-memory store and storage when cache is wiped", async () => {
    useSearchHistoryStore.getState().addItem({
      id: "track-1",
      type: "track",
      title: "Track One",
    });
    expect(useSearchHistoryStore.getState().items.length).toBe(1);

    await clearSearchAndQueryCache();

    expect(useSearchHistoryStore.getState().items).toEqual([]);
    expect(debouncedStorage.getItem("liner_search_history")).toBeNull();
  });
});
