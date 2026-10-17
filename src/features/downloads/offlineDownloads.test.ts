import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/shared/types";

const { createSession } = vi.hoisted(() => ({ createSession: vi.fn() }));
vi.mock("@/shared/api", () => ({
  api: { createPlaybackSession: createSession },
  mediaUrl: (url: string) => url,
}));
vi.mock("@/features/lyrics", () => ({
  shouldCacheLyricsCandidate: () => true,
  compareLyricsCandidates: () => 0,
}));
vi.mock("@/shared/api/visitorSession", () => ({ getClientVisitorData: async () => "" }));

const track = (id: string): Track => ({ id, title: id, artists: "Artist", coverUrl: "", durationMs: 60000, playCount: 0 });
const blob = () => new NodeBlob(["OggSdownloaded audio"], { type: "audio/ogg" }) as unknown as Blob;
let db: typeof import("@/shared/storage/linerDb").linerDb;
let cache: typeof import("@/shared/storage/audioCache").audioCache;
let store: typeof import("./store/downloadStore").useDownloadStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  db = (await import("@/shared/storage/linerDb")).linerDb;
  cache = (await import("@/shared/storage/audioCache")).audioCache;
  store = (await import("./store/downloadStore")).useDownloadStore;
  await db.clearAll();
  createSession.mockReset().mockImplementation(async (id: string) => ({ streamUrl: `https://audio.test/${id}`, mimeType: "audio/ogg" }));
  fetchMock = vi.fn().mockImplementation(async () => ({ ok: true, blob: async () => blob() }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  store.getState().cancel();
  await db.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("offline playlist downloads", () => {
  it("rejects media fragments even when the response claims to be audio", async () => {
    fetchMock.mockResolvedValue({ ok: true, blob: async () =>
      new NodeBlob([new Uint8Array([0, 0, 0, 24, 115, 116, 121, 112, 0, 0, 0, 0, 0, 0, 0, 0])], { type: "audio/mp4" }) });
    await store.getState().save("fragment", "Fragment", [track("a")]);
    expect(store.getState().errors.fragment).toBe("unavailable");
    expect(store.getState().playlists[0].downloadedIds).toEqual([]);
    expect(await db.getAudio("a")).toBeNull();
  });

  it("resolves direct playback plans before downloading audio", async () => {
    createSession.mockResolvedValue({ transport: "direct_innertube", endpoint: "https://player.test/resolve",
      method: "POST", headers: {}, body: { context: { client: {} } } });
    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => ({
      streamingData: { adaptiveFormats: [{ url: "https://audio.test/direct", mimeType: "audio/webm; codecs=opus" }] },
    }) }));
    await store.getState().save("direct", "Direct", [track("a")]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://player.test/resolve", "https://audio.test/direct"]);
    expect(store.getState().playlists[0].downloadedIds).toEqual(["a"]);
    expect((await db.getAudio("a"))?.mimeType).toBe("audio/webm");
  });

  it("reports unavailable when a playback session has no stream", async () => {
    createSession.mockResolvedValue({});
    await store.getState().save("missing", "Missing", [track("a")]);
    expect(store.getState().errors.missing).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds the session fallback after failed writes and releases it after recovery", async () => {
    const fail = vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    for (let i = 0; i < 6; i++) await db.putAudio(String(i), blob(), "audio/ogg");
    expect(await db.getAudio("0")).toBeNull();
    expect((await db.getAudio("5"))?.blob.size).toBe(blob().size);
    await db.touchAudio("5");
    expect((db as unknown as { memAudio: Map<string, unknown> }).memAudio.size).toBe(4);
    fail.mockRestore();
    await db.putAudio("5", blob(), "audio/ogg");
    expect((db as unknown as { memAudio: Map<string, unknown> }).memAudio.has("5")).toBe(false);
    expect((await db.getAudio("5"))?.blob.size).toBe(blob().size);
  });

  it("persists complete audio and metadata across a fresh storage instance", async () => {
    await store.getState().save("p1", "Saved playlist", [track("a"), track("b")]);
    expect(store.getState().playlists[0].downloadedIds).toEqual(["a", "b"]);
    expect((db as unknown as { memAudio: Map<string, unknown> }).memAudio.size).toBe(0);
    await db.close();
    vi.resetModules();
    const fresh = (await import("@/shared/storage/linerDb")).linerDb;
    expect((await fresh.getOfflinePlaylists())[0].title).toBe("Saved playlist");
    expect((await fresh.getAudio("a"))?.blob.size).toBe(blob().size);
    await fresh.close();
  });

  it("keeps shared downloads during eviction, cache cleanup and removal of one playlist", async () => {
    await store.getState().save("p1", "First", [track("a")]);
    await store.getState().save("p2", "Second", [track("a"), track("b")]);
    await db.putAudio("temporary", blob(), "audio/ogg");
    await cache.enforceCacheLimit(1);
    expect(await db.hasAudio("temporary")).toBe(false);
    expect(await db.hasAudio("a")).toBe(true);
    await db.clearTemporaryAudio();
    await store.getState().remove("p1");
    expect(await db.hasAudio("a")).toBe(true);
    await store.getState().remove("p2");
    expect(await db.hasAudio("a")).toBe(false);
    expect(await db.hasAudio("b")).toBe(false);
  });

  it("retains completed files after failure and retries only the missing track", async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: true, blob: async () => blob() }))
      .mockRejectedValueOnce(new Error("Disconnected"));
    await store.getState().save("p1", "Partial", [track("a"), track("b")]);
    expect(store.getState().playlists[0].downloadedIds).toEqual(["a"]);
    expect(store.getState().errors.p1).toBe("network");
    await store.getState().save("p1", "Partial", [track("a"), track("b")]);
    expect(createSession.mock.calls.map(([id]) => id)).toEqual(["a", "b", "b"]);
    expect(store.getState().playlists[0].downloadedIds).toEqual(["a", "b"]);
  });

  it("cancels an in-flight request without losing completed tracks", async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: true, blob: async () => blob() }))
      .mockImplementationOnce((_url: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))));
    const pending = store.getState().save("p1", "Cancelled", [track("a"), track("b")]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    store.getState().cancel();
    await pending;
    expect(store.getState().activeId).toBeNull();
    expect(store.getState().errors.p1).toBeUndefined();
    expect((await db.getOfflinePlaylists())[0].downloadedIds).toEqual(["a"]);
  });

  it("does not claim success when the audio transaction aborts", async () => {
    const transaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (this: IDBDatabase, ...args: Parameters<IDBDatabase["transaction"]>) {
      const tx = transaction.apply(this, args);
      if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
      return tx;
    });
    await expect(db.saveOfflineTrack({ id: "p1", title: "Failed", tracks: [track("a")], downloadedIds: ["a"], savedAt: 0 }, "a", blob(), "audio/ogg")).rejects.toThrow();
    expect(await db.hasAudio("a")).toBe(false);
    expect(await db.getOfflinePlaylists()).toEqual([]);
  });

  it("reports disk errors and never publishes an uncommitted track", async () => {
    vi.spyOn(db, "saveOfflineTrack").mockRejectedValue(new DOMException("Full", "QuotaExceededError"));
    await store.getState().save("p1", "No space", [track("a")]);
    expect(store.getState().errors.p1).toBe("storage");
    expect(store.getState().playlists[0].downloadedIds).toEqual([]);
    expect(await db.hasAudio("a")).toBe(false);
  });

  it("removes stale completion badges when files are missing on startup", async () => {
    await db.putOfflinePlaylist({ id: "p1", title: "Missing", tracks: [track("a")], downloadedIds: ["a"], savedAt: 0 });
    await store.getState().load();
    expect(store.getState().playlists[0].downloadedIds).toEqual([]);
  });

  it("stores available artwork with the local track metadata", async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      blob: async () => url.includes("cover.test")
        ? new Blob(["test image"], { type: "image/png" }) : blob(),
    }));
    await store.getState().save("p1", "Artwork", [{ ...track("a"), coverUrl: "https://cover.test/a.png" }]);
    expect((await db.getOfflinePlaylists())[0].tracks[0].coverUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects a partial media response instead of marking it downloaded", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 206, headers: new Headers({ "content-range": "bytes 0-15/200" }), blob: async () => blob() });
    await store.getState().save("p1", "Partial response", [track("a")]);
    expect(store.getState().errors.p1).toBe("unavailable");
    expect(store.getState().playlists[0].downloadedIds).toEqual([]);
  });
});
