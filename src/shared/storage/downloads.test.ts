import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { linerDb } from "./linerDb";

const track = (id: string, title = id) => ({
  id,
  title,
  artists: "Artist",
  durationMs: 1000,
  coverUrl: "",
  playCount: 0,
});

describe("linerDb.getDownloadedTracks", () => {
  beforeEach(async () => {
    await linerDb.clearAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing when no audio is cached", async () => {
    await linerDb.putTrack(track("a"));
    expect(await linerDb.getDownloadedTracks("user-a")).toEqual([]);
  });

  it("returns nothing without a signed-in account", async () => {
    await linerDb.putTrack(track("a"));
    await linerDb.putAudio("a", new Blob(["x"]), "audio/ogg", undefined, "user-a");
    expect(await linerDb.getDownloadedTracks(null)).toEqual([]);
    expect(await linerDb.getDownloadedTracks(undefined)).toEqual([]);
    expect(await linerDb.getDownloadedTracks("")).toEqual([]);
  });

  it("only lists the tracks of the requested account", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    await linerDb.putTrack(track("mine"));
    await linerDb.putAudio("mine", blob, "audio/ogg", undefined, "user-a");
    await linerDb.putTrack(track("theirs"));
    await linerDb.putAudio("theirs", blob, "audio/ogg", undefined, "user-b");

    expect((await linerDb.getDownloadedTracks("user-a")).map((t) => t.id)).toEqual(["mine"]);
    expect((await linerDb.getDownloadedTracks("user-b")).map((t) => t.id)).toEqual(["theirs"]);
    expect(await linerDb.getDownloadedTracks("user-c")).toEqual([]);
  });

  it("never lists files cached before owners were recorded", async () => {
    await linerDb.putTrack(track("legacy"));
    await linerDb.putAudio("legacy", new Blob(["x"]), "audio/ogg");
    expect(await linerDb.getDownloadedTracks("user-a")).toEqual([]);
  });

  it("shares a file with a second account once it plays it, without dropping the first", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    await linerDb.putTrack(track("song"));
    await linerDb.putAudio("song", blob, "audio/ogg", undefined, "user-a");
    await linerDb.addAudioOwner("song", "user-b");
    await linerDb.addAudioOwner("song", "user-b");

    expect((await linerDb.getAudio("song"))?.ownerIds).toEqual(["user-a", "user-b"]);
    expect((await linerDb.getDownloadedTracks("user-b")).map((t) => t.id)).toEqual(["song"]);
    expect((await linerDb.getDownloadedTracks("user-a")).map((t) => t.id)).toEqual(["song"]);
  });

  it("keeps earlier owners when another account re-downloads the file", async () => {
    await linerDb.putTrack(track("song"));
    await linerDb.putAudio("song", new Blob(["x"]), "audio/ogg", undefined, "user-a");
    await linerDb.putAudio("song", new Blob(["xy"]), "audio/ogg", undefined, "user-b");
    expect((await linerDb.getAudio("song"))?.ownerIds).toEqual(["user-a", "user-b"]);
  });

  it("ignores an empty owner when adding one", async () => {
    await linerDb.putAudio("song", new Blob(["x"]), "audio/ogg");
    await linerDb.addAudioOwner("song", null);
    await linerDb.addAudioOwner("missing", "user-a");
    expect((await linerDb.getAudio("song"))?.ownerIds).toBeUndefined();
    expect(await linerDb.getAudio("missing")).toBeNull();
  });

  it("lists only tracks with both metadata and audio, most recently played first", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    vi.setSystemTime(1_000);
    await linerDb.putTrack(track("old", "Old"));
    await linerDb.putAudio("old", blob, "audio/ogg", undefined, "user-a");
    vi.setSystemTime(2_000);
    await linerDb.putTrack(track("new", "New"));
    await linerDb.putAudio("new", blob, "audio/ogg", undefined, "user-a");
    // queued but never downloaded
    await linerDb.putTrack(track("queued"));
    // audio without metadata cannot be shown
    await linerDb.putAudio("orphan", blob, "audio/ogg", undefined, "user-a");

    const list = await linerDb.getDownloadedTracks("user-a");
    expect(list.map((t) => t.id)).toEqual(["new", "old"]);
    expect(list[0].title).toBe("New");
  });

  it("drops a track once its audio is evicted", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    await linerDb.putTrack(track("a"));
    await linerDb.putAudio("a", blob, "audio/ogg", undefined, "user-a");
    await linerDb.deleteAudio("a");
    expect(await linerDb.getDownloadedTracks("user-a")).toEqual([]);
  });
});
