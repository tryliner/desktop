import { describe, it, expect, vi, beforeEach } from "vitest";

const session = vi.hoisted(() => ({ userId: "alice" as string | null }));
vi.mock("@/shared/api", () => ({
  getAuthSession: () =>
    session.userId ? { user: { id: session.userId } } : null,
}));

import {
  setPlaylistCoverAdapter,
  usePlaylistCoversStore,
  type PlaylistCoverAdapter,
} from "./playlistCoverStore";

function memoryAdapter(): PlaylistCoverAdapter & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  let n = 0;
  return {
    data,
    async list(userId) {
      return Object.fromEntries(
        [...data]
          .filter(([key]) => key.startsWith(`${userId}/`))
          .map(([key, url]) => [key.slice(userId.length + 1), url]),
      );
    },
    async set(userId, playlistId) {
      const url = `mem://${userId}/${playlistId}?v=${++n}`;
      data.set(`${userId}/${playlistId}`, url);
      return url;
    },
    async remove(userId, playlistId) {
      data.delete(`${userId}/${playlistId}`);
    },
  };
}

describe("playlist cover store", () => {
  let adapter: ReturnType<typeof memoryAdapter>;

  beforeEach(() => {
    session.userId = "alice";
    adapter = memoryAdapter();
    setPlaylistCoverAdapter(adapter);
    usePlaylistCoversStore.setState({
      userId: null,
      covers: {},
      loaded: false,
    });
  });

  it("saves a cover and exposes its url", async () => {
    await usePlaylistCoversStore.getState().setCover("p1", new Blob(["x"]));
    expect(usePlaylistCoversStore.getState().covers.p1).toMatch(
      /^mem:\/\/alice\/p1/,
    );
  });

  it("removes optimistically so the mosaic returns at once", async () => {
    await usePlaylistCoversStore.getState().setCover("p1", new Blob(["x"]));
    const pending = usePlaylistCoversStore.getState().removeCover("p1");
    expect(usePlaylistCoversStore.getState().covers.p1).toBeUndefined();
    await pending;
    expect(adapter.data.size).toBe(0);
  });

  it("loads only the signed-in account's covers", async () => {
    await adapter.set("alice", "a1", new Blob());
    await adapter.set("bob", "b1", new Blob());
    await usePlaylistCoversStore.getState().load(true);
    expect(Object.keys(usePlaylistCoversStore.getState().covers)).toEqual([
      "a1",
    ]);
  });

  it("is empty and refuses to save while signed out", async () => {
    session.userId = null;
    await usePlaylistCoversStore.getState().load(true);
    expect(usePlaylistCoversStore.getState().covers).toEqual({});
    await expect(
      usePlaylistCoversStore.getState().setCover("p1", new Blob()),
    ).rejects.toMatchObject({ reason: "signed-out" });
  });
});
