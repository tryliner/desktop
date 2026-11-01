import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SavedTrackLibrary, savedTrackKey } from "./library";

const meta = {
  trackId: "dQw4w9WgXcQ",
  title: "Never Gonna Give You Up",
  artists: "Rick Astley",
  durationMs: 213000,
};

const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

describe("SavedTrackLibrary", () => {
  let root: string;

  beforeEach(async () => {
    root = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), "liner-saved-")),
      "saved",
    );
  });

  afterEach(async () => {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  });

  it("stores audio, cover and lyrics under a hashed key", async () => {
    const library = new SavedTrackLibrary(root);
    const record = await library.saveTrack({
      meta,
      audio,
      mimeType: "audio/webm; codecs=opus",
      cover: { data: new Uint8Array([1, 2]), mimeType: "image/jpeg" },
      lyricsState: "found",
      lyrics: { lyrics: { content: "la la" } },
    });

    const key = savedTrackKey(meta.trackId);
    expect(record).toMatchObject({
      key,
      trackId: meta.trackId,
      audioFile: `${key}.webm`,
      coverFile: `${key}.jpg`,
      mimeType: "audio/webm",
      lyrics: "found",
      byteSize: audio.byteLength,
    });
    expect(await library.readLyrics(meta.trackId)).toEqual({
      lyrics: { content: "la la" },
    });
    expect((await library.locate("audio", key))?.mimeType).toBe("audio/webm");
    expect(await library.locate("audio", "../../etc")).toBeNull();
  });

  it("keeps one record per track and its first save time", async () => {
    const library = new SavedTrackLibrary(root);
    const first = await library.saveTrack({
      meta,
      audio,
      mimeType: "audio/mp4",
    });
    const second = await library.saveTrack({
      meta,
      audio,
      mimeType: "audio/webm",
      lyricsState: "missing",
    });

    const records = await library.list();
    expect(records).toHaveLength(1);
    expect(second?.savedAt).toBe(first?.savedAt);
    expect(second?.lyrics).toBe("missing");
    await expect(
      fs.access(path.join(root, "audio", first!.audioFile)),
    ).rejects.toThrow();
  });

  it("refuses audio it cannot name", async () => {
    const library = new SavedTrackLibrary(root);
    expect(
      await library.saveTrack({ meta, audio, mimeType: "text/html" }),
    ).toBeNull();
    expect(await library.list()).toEqual([]);
  });

  it("removes files with their records and reports usage", async () => {
    const library = new SavedTrackLibrary(root);
    await library.saveTrack({ meta, audio, mimeType: "audio/webm" });
    await library.saveTrack({
      meta: { ...meta, trackId: "other" },
      audio,
      mimeType: "audio/webm",
    });

    expect((await library.usage()).count).toBe(2);
    expect(await library.remove([meta.trackId])).toBe(1);
    expect((await library.list()).map((record) => record.trackId)).toEqual([
      "other",
    ]);
    expect(await library.removeAll()).toBe(1);
    const usage = await library.usage();
    expect(usage.count).toBe(0);
    expect(usage.bytes).toBe(0);
  });
});
