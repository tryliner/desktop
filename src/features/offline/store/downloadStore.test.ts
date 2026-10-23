import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDownloadStore } from "./downloadStore";

describe("useDownloadStore", () => {
  beforeEach(() => {
    useDownloadStore.setState({
      downloads: new Map(),
      activeCount: 0,
      maxConcurrent: 3,
    });
    vi.restoreAllMocks();
  });

  it("initializes with empty downloads map and zero active downloads", () => {
    const state = useDownloadStore.getState();
    expect(state.downloads.size).toBe(0);
    expect(state.activeCount).toBe(0);
    expect(state.getStatus("track-1")).toBe("idle");
  });

  it("queues track download and updates status to queued or downloading", () => {
    // Mock fetch for executeDownload
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(() => {}) // never resolves to keep downloading
    );

    useDownloadStore.getState().queueDownload("track-1");
    const item = useDownloadStore.getState().downloads.get("track-1");
    expect(item).toBeDefined();
    expect(["queued", "downloading"]).toContain(item?.status);
  });

  it("queues multiple playlist track downloads", () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    useDownloadStore.getState().queuePlaylistDownloads(["t1", "t2", "t3", "t4"]);
    const state = useDownloadStore.getState();
    expect(state.downloads.size).toBe(4);
    expect(state.activeCount).toBeLessThanOrEqual(3);
  });

  it("cancels queued and active downloads cleanly", () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    useDownloadStore.getState().queueDownload("track-to-cancel");
    expect(useDownloadStore.getState().downloads.has("track-to-cancel")).toBe(true);

    useDownloadStore.getState().cancelDownload("track-to-cancel");
    expect(useDownloadStore.getState().downloads.has("track-to-cancel")).toBe(false);
  });

  it("clears completed and error downloads", () => {
    const downloads = new Map();
    downloads.set("t1", { trackId: "t1", status: "complete", progress: 100 });
    downloads.set("t2", { trackId: "t2", status: "error", progress: 0, error: "Network error" });
    downloads.set("t3", { trackId: "t3", status: "downloading", progress: 45 });

    useDownloadStore.setState({ downloads });

    useDownloadStore.getState().clearCompleted();
    const remaining = useDownloadStore.getState().downloads;
    expect(remaining.has("t1")).toBe(false);
    expect(remaining.has("t2")).toBe(false);
    expect(remaining.has("t3")).toBe(true);
  });
});
