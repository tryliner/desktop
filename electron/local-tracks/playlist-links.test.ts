import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalPlaylistLinkStore } from "./playlist-links.js";

const FILE_A = "a".repeat(20);
const FILE_B = "b".repeat(20);

const entry = (fileId: string, title = "song") => ({
  fileId,
  title,
  artist: "artist",
  durationMs: 1000,
  addedAt: 1,
});

describe("LocalPlaylistLinkStore", () => {
  let root: string;

  beforeEach(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "liner-links-"));
  });
  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  it("adds, lists and persists entries", async () => {
    const store = new LocalPlaylistLinkStore(root);
    expect(await store.add("p1", entry(FILE_A, "one"))).toBe(true);
    expect(await store.add("p1", entry(FILE_B))).toBe(true);
    const fresh = new LocalPlaylistLinkStore(root);
    const links = await fresh.list();
    expect(links.p1.map((e) => e.fileId)).toEqual([FILE_A, FILE_B]);
    expect(links.p1[0].title).toBe("one");
  });

  it("refuses duplicates and malformed entries", async () => {
    const store = new LocalPlaylistLinkStore(root);
    expect(await store.add("p1", entry(FILE_A))).toBe(true);
    expect(await store.add("p1", entry(FILE_A))).toBe(false);
    expect(await store.add("p1", entry("../../etc/passwd"))).toBe(false);
    expect(await store.add("p1", null)).toBe(false);
    expect((await store.list()).p1).toHaveLength(1);
  });

  it("removes one entry, and drops empty playlists", async () => {
    const store = new LocalPlaylistLinkStore(root);
    await store.add("p1", entry(FILE_A));
    await store.add("p1", entry(FILE_B));
    await store.remove("p1", FILE_A);
    expect((await store.list()).p1.map((e) => e.fileId)).toEqual([FILE_B]);
    await store.remove("p1", FILE_B);
    expect(await store.list()).toEqual({});
  });

  it("removes a whole playlist", async () => {
    const store = new LocalPlaylistLinkStore(root);
    await store.add("p1", entry(FILE_A));
    await store.add("p2", entry(FILE_A));
    await store.removePlaylist("p1");
    expect(Object.keys(await store.list())).toEqual(["p2"]);
  });

  it("starts empty when the file is corrupt", async () => {
    await fsp.writeFile(path.join(root, "playlist-links.json"), "{nope");
    expect(await new LocalPlaylistLinkStore(root).list()).toEqual({});
  });
});
