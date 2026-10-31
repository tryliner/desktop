import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("keeps lyrics on disk with the track until the track is removed", async () => {
    const library = new LocalTrackLibrary(root);
    const { added } = await library.importFiles([
      await source("Artist - Song.mp3", "mp3"),
    ]);
    const [record] = added;
    const lyrics = { provider: "lrclib", lyrics: { content: "[00:01.00] hi" } };

    expect(await library.setLyrics(record.id, "found", lyrics)).toBe(true);
    expect(await new LocalTrackLibrary(root).readLyrics(record.id)).toEqual(
      lyrics,
    );
    expect((await new LocalTrackLibrary(root).list())[0].lyrics).toBe("found");

    await library.remove([record.id]);
    await expect(
      fs.access(path.join(root, "lyrics", `${record.id}.json`)),
    ).rejects.toThrow();
  });

  it("records a missed search without writing a lyrics file", async () => {
    const library = new LocalTrackLibrary(root);
    const { added } = await library.importFiles([
      await source("Artist - Quiet.mp3", "quiet"),
    ]);

    expect(await library.setLyrics(added[0].id, "missing")).toBe(true);
    expect((await library.list())[0].lyrics).toBe("missing");
    expect(await library.readLyrics(added[0].id)).toBeNull();
    expect(await library.setLyrics("0".repeat(20), "missing")).toBe(false);
  });

  it("removes every track with its files and reports the space they used", async () => {
    const library = new LocalTrackLibrary(root);
    const { added } = await library.importFiles([
      await source("One - A.mp3", "aaaa"),
      await source("Two - B.mp3", "bbbbbb"),
    ]);
    await library.setLyrics(added[0].id, "found", { line: "x" });

    const usage = await library.usage();
    expect(usage.count).toBe(2);
    expect(usage.bytes).toBeGreaterThanOrEqual(10);

    expect(await library.removeAll()).toBe(2);
    expect(await library.list()).toEqual([]);
    await expect(fs.access(path.join(root, "audio"))).rejects.toThrow();
    await expect(fs.access(path.join(root, "lyrics"))).rejects.toThrow();
    expect(await library.usage()).toEqual({ count: 0, bytes: 0 });
  });

  it("refuses ids that could escape the library folder", async () => {
    const library = new LocalTrackLibrary(root);
    expect(await library.locate("audio", "../../etc/passwd")).toBeNull();
  });
});
