import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalTrackLibrary } from "./library";

describe("LocalTrackLibrary", () => {
  let root: string;
  let sources: string;

  const source = async (name: string, content: string) => {
    const file = path.join(sources, name);
    await fs.writeFile(file, content);
    return file;
  };

  beforeEach(async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "liner-local-"));
    root = path.join(base, "library");
    sources = path.join(base, "sources");
    await fs.mkdir(sources);
  });

  afterEach(async () => {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  });

  it("copies audio into its own folder and names tracks from the file name", async () => {
    const library = new LocalTrackLibrary(root);
    const file = await source(
      "03 - Boards of Canada - Roygbiv.mp3",
      "not really mp3",
    );
    const result = await library.importFiles([file]);

    expect(result.added).toHaveLength(1);
    const [record] = result.added;
    expect(record).toMatchObject({
      artist: "Boards of Canada",
      title: "Roygbiv",
      mimeType: "audio/mpeg",
    });
    await expect(
      fs.readFile(path.join(root, "audio", record.audioFile), "utf8"),
    ).resolves.toBe("not really mp3");

    await fs.rm(file);
    expect(await new LocalTrackLibrary(root).list()).toEqual([record]);
  });

  it("skips the same file twice and rejects files that are not audio", async () => {
    const library = new LocalTrackLibrary(root);
    const first = await source("a.flac", "same bytes");
    const copy = await source("b.flac", "same bytes");
    const notes = await source("notes.txt", "hello");

    const result = await library.importFiles([first, copy, notes]);

    expect(result.added).toHaveLength(1);
    expect(result.duplicates).toBe(1);
    expect(result.failed).toEqual(["notes.txt"]);
  });

  it("removes the record together with its files", async () => {
    const library = new LocalTrackLibrary(root);
    const { added } = await library.importFiles([
      await source("song.ogg", "ogg"),
    ]);
    const [record] = added;

    await library.remove([record.id]);

    expect(await library.list()).toEqual([]);
    expect(await library.locate("audio", record.id)).toBeNull();
    await expect(
      fs.access(path.join(root, "audio", record.audioFile)),
    ).rejects.toThrow();
  });

  it("refuses an audio-named link that points at a non-audio file", async () => {
    const library = new LocalTrackLibrary(root);
    const secret = await source("id_rsa", "private key");
    const disguised = path.join(sources, "song.mp3");
    await fs.symlink(secret, disguised);

    const result = await library.importFiles([disguised]);

    expect(result.added).toEqual([]);
    expect(result.failed).toEqual(["song.mp3"]);
  });

  it("removes every track with its files and reports the space they used", async () => {
    const library = new LocalTrackLibrary(root);
    await library.importFiles([
      await source("One - A.mp3", "aaaa"),
      await source("Two - B.mp3", "bbbbbb"),
    ]);
    const usage = await library.usage();
    expect(usage.count).toBe(2);
    expect(usage.bytes).toBeGreaterThanOrEqual(10);

    expect(await library.removeAll()).toBe(2);
    expect(await library.list()).toEqual([]);
    await expect(fs.access(path.join(root, "audio"))).rejects.toThrow();
    expect(await library.usage()).toEqual({ count: 0, bytes: 0 });
  });

  it("retains tracks in the index when audio folder removal fails", async () => {
    const library = new LocalTrackLibrary(root);
    const { added } = await library.importFiles([
      await source("One - A.mp3", "aaaa"),
    ]);

    const originalRm = fs.rm;
    vi.spyOn(fs, "rm").mockImplementation(async (targetPath, options) => {
      if (String(targetPath).endsWith("audio")) {
        throw new Error("Simulated rm failure on audio");
      }
      return originalRm(targetPath, options);
    });

    try {
      await expect(library.removeAll()).rejects.toThrow(
        "Simulated rm failure on audio",
      );
      const list = await library.list();
      expect(list.some((track) => track.id === added[0].id)).toBe(true);
      await expect(
        fs.access(path.join(root, "audio")),
      ).resolves.toBeUndefined();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("copies paired .lrc file into lyrics folder when present", async () => {
    const library = new LocalTrackLibrary(root);
    const audio = await source("01 - Test.mp3", "dummy audio");
    await source("01 - Test.lrc", "[00:01.00]Hello world");

    const result = await library.importFiles([audio]);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].lrcFile).toBeDefined();

    const located = await library.locate("lyrics", result.added[0].id);
    expect(located).not.toBeNull();
    const lrcContent = await fs.readFile(located!.path, "utf8");
    expect(lrcContent).toContain("[00:01.00]Hello world");
  });

  it("refuses ids that could escape the library folder", async () => {
    const library = new LocalTrackLibrary(root);
    expect(await library.locate("audio", "../../etc/passwd")).toBeNull();
  });
});
