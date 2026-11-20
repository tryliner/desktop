import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserMediaLibrary, UserMediaRejection, userMediaKey } from "./library";
import { GIF, JPEG, MP4, PNG, ascii, pad } from "./fixtures";

describe("UserMediaLibrary", () => {
  let root: string;
  const images = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ] as const);

  beforeEach(async () => {
    root = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), "liner-media-")),
      "covers",
    );
  });

  afterEach(async () => {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  });

  const library = (maxPerOwner?: number) =>
    new UserMediaLibrary(root, { accept: images, maxBytes: 64, maxPerOwner });

  it("stores under a hashed key with the sniffed extension", async () => {
    const lib = library();
    const record = await lib.set("user-1", "playlist-a", PNG);
    expect(record.key).toBe(userMediaKey("user-1", "playlist-a"));
    expect(record.file).toBe(`${record.key}.png`);
    expect(record.mimeType).toBe("image/png");
    const located = await lib.locate(record.key);
    expect(located?.path).toBe(path.join(root, record.file));
    expect(await fs.readFile(located!.path)).toEqual(Buffer.from(PNG));
  });

  it("replaces a cover and removes the old file when the type changes", async () => {
    const lib = library();
    const first = await lib.set("u", "p", PNG);
    const second = await lib.set("u", "p", JPEG);
    expect(second.key).toBe(first.key);
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    await expect(fs.stat(path.join(root, first.file))).rejects.toThrow();
    expect((await lib.list("u")).map((r) => r.file)).toEqual([second.file]);
  });

  it("refuses types it wasn't told to accept and oversized files", async () => {
    const lib = library();
    await expect(lib.set("u", "p", MP4)).rejects.toBeInstanceOf(
      UserMediaRejection,
    );
    await expect(
      lib.set("u", "p", pad(ascii("hello world"))),
    ).rejects.toMatchObject({ reason: "unsupported-type" });
    await expect(
      lib.set(
        "u",
        "p",
        pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 65),
      ),
    ).rejects.toMatchObject({ reason: "too-large" });
    await expect(lib.set("u", "p", new Uint8Array())).rejects.toMatchObject({
      reason: "empty",
    });
  });

  it("keeps accounts apart", async () => {
    const lib = library();
    await lib.set("alice", "shared-id", PNG);
    await lib.set("bob", "shared-id", GIF);
    expect((await lib.list("alice")).map((r) => r.mimeType)).toEqual([
      "image/png",
    ]);
    expect(await lib.removeKey(userMediaKey("alice", "shared-id"), "bob")).toBe(
      false,
    );
    expect(await lib.remove("alice", "shared-id")).toBe(true);
    expect(await lib.list("alice")).toEqual([]);
    expect(await lib.list("bob")).toHaveLength(1);
  });

  it("only locates keys that are in its index", async () => {
    const lib = library();
    await lib.set("u", "p", PNG);
    expect(await lib.locate("../../etc/passwd")).toBeNull();
    expect(await lib.locate("0".repeat(20))).toBeNull();
  });

  it("ignores index entries that point outside the folder", async () => {
    await fs.mkdir(root, { recursive: true });
    const key = "a".repeat(20);
    await fs.writeFile(
      path.join(root, "index.json"),
      JSON.stringify([
        {
          key,
          owner: "u",
          ref: "p",
          file: "../escape.png",
          mimeType: "image/png",
          byteSize: 1,
          updatedAt: 1,
        },
      ]),
    );
    expect(await library().locate(key)).toBeNull();
  });

  it("drops the oldest items past the per-owner cap", async () => {
    const lib = library(2);
    const a = await lib.set("u", "a", PNG);
    await lib.set("u", "b", JPEG);
    await lib.set("u", "c", GIF);
    const kept = await lib.list("u");
    expect(kept.map((r) => r.ref)).toEqual(["c", "b"]);
    await expect(fs.stat(path.join(root, a.file))).rejects.toThrow();
  });

  it("survives a corrupt index", async () => {
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "index.json"), "{not json");
    expect(await library().list("u")).toEqual([]);
  });

  it("refuses to work over an index it can't read", async () => {
    await fs.mkdir(path.join(root, "index.json"), { recursive: true });
    const lib = library();
    await expect(lib.list("u")).rejects.toThrow();
    await expect(lib.set("u", "p", PNG)).rejects.toThrow();
    expect((await fs.stat(path.join(root, "index.json"))).isDirectory()).toBe(
      true,
    );
  });
});
