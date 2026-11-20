import { describe, it, expect, vi, beforeEach } from "vitest";

const session = vi.hoisted(() => ({ userId: "alice" as string | null }));
vi.mock("@/shared/api", () => ({
  getAuthSession: () =>
    session.userId ? { user: { id: session.userId } } : null,
}));

import {
  DOWNLOADS_KEY,
  currentDownloads,
  estimateBytes,
  pinnedCollectionSnapshot,
  pinnedTrackList,
  useDownloadsStore,
} from "./downloadsStore";

const song = (id: string, durationMs = 180_000) => ({
  id,
  title: `Song ${id}`,
  artists: "Artist",
  coverUrl: "",
  durationMs,
});

const store = () => useDownloadsStore.getState();

describe("downloads store", () => {
  beforeEach(() => {
    session.userId = "alice";
    localStorage.clear();
    useDownloadsStore.setState({ byAccount: {} });
  });

  it("pins and unpins songs, skipping files on this device", () => {
    store().pinTracks([song("a"), song("local:x"), song("b")]);
    expect(Object.keys(currentDownloads().tracks).sort()).toEqual(["a", "b"]);
    store().unpinTracks(["a"]);
    expect(Object.keys(currentDownloads().tracks)).toEqual(["b"]);
  });

  it("persists per account and keeps accounts apart", () => {
    store().pinTracks([song("a")]);
    session.userId = "bob";
    expect(currentDownloads().tracks).toEqual({});
    store().pinTracks([song("b")]);
    const saved = JSON.parse(localStorage.getItem(DOWNLOADS_KEY)!);
    expect(Object.keys(saved.alice.tracks)).toEqual(["a"]);
    expect(Object.keys(saved.bob.tracks)).toEqual(["b"]);
  });

  it("does nothing while signed out", () => {
    session.userId = null;
    store().pinTracks([song("a")]);
    expect(store().byAccount).toEqual({});
  });

  it("follows a pinned playlist as it changes", () => {
    store().pinCollection({
      id: "pl1",
      kind: "playlist",
      title: "Road trip",
      coverUrl: "",
      tracks: [song("a"), song("b")],
    });
    const before = store().byAccount;
    store().updateCollectionTracks("pl1", [song("a"), song("b")]);
    expect(store().byAccount).toBe(before);
    store().updateCollectionTracks("pl1", [song("b"), song("c")]);
    expect(
      pinnedCollectionSnapshot("pl1")?.tracks.map((track) => track.id),
    ).toEqual(["b", "c"]);
    store().unpinCollection("pl1");
    expect(pinnedCollectionSnapshot("pl1")).toBeNull();
  });

  it("lists every wanted song once, single pins first", () => {
    store().pinCollection({
      id: "al1",
      kind: "album",
      title: "Album",
      coverUrl: "",
      tracks: [song("x"), song("shared")],
    });
    store().pinTracks([song("shared"), song("solo")]);
    const ids = pinnedTrackList(currentDownloads()).map((track) => track.id);
    expect(ids.slice(0, 2).sort()).toEqual(["shared", "solo"]);
    expect(ids).toHaveLength(3);
    expect(ids).toContain("x");
  });

  it("estimates size from duration, assuming ~160 kbps", () => {
    expect(estimateBytes([song("a", 60_000)])).toBe(1_200_000);
    expect(estimateBytes([song("b", 0)])).toBe(4_200_000);
  });
});
