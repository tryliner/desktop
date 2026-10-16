// @vitest-environment node
// the other storage tests run in jsdom, which has no indexeddb, so they only reach the
// in-memory fallback. these go through the real indexeddb code path.
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { linerDb } from "./linerDb";

const track = (id: string) => ({
  id,
  title: id,
  artists: "Artist",
  durationMs: 1000,
  coverUrl: "",
  playCount: 0,
});

// drops the in-memory mirror so the next read has to come from indexeddb, like after a restart
function restart() {
  (linerDb as any).memAudio.clear();
  (linerDb as any).memTracks.clear();
}

describe("linerDb downloads on indexeddb", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000);
    await linerDb.clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("really uses indexeddb in this file", async () => {
    await linerDb.putTrack(track("probe"));
    await linerDb.putAudio("probe", new Blob(["x"]), "audio/ogg", undefined, "user-a");
    restart();
    expect((await linerDb.getAudio("probe"))?.ownerIds).toEqual(["user-a"]);
  });

  it("lists only the requested account's tracks", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    await linerDb.putTrack(track("mine"));
    await linerDb.putAudio("mine", blob, "audio/ogg", undefined, "user-a");
    await linerDb.putTrack(track("theirs"));
    await linerDb.putAudio("theirs", blob, "audio/ogg", undefined, "user-b");
    restart();

    expect((await linerDb.getDownloadedTracks("user-a")).map((t) => t.id)).toEqual(["mine"]);
    expect((await linerDb.getDownloadedTracks("user-b")).map((t) => t.id)).toEqual(["theirs"]);
    expect(await linerDb.getDownloadedTracks("user-c")).toEqual([]);
    expect(await linerDb.getDownloadedTracks(null)).toEqual([]);
  });

  it("orders by last play and skips legacy files and files without metadata", async () => {
    const blob = new Blob(["x"], { type: "audio/ogg" });
    vi.setSystemTime(1_000);
    await linerDb.putTrack(track("old"));
    await linerDb.putAudio("old", blob, "audio/ogg", undefined, "user-a");
    vi.setSystemTime(3_000);
    await linerDb.putTrack(track("new"));
    await linerDb.putAudio("new", blob, "audio/ogg", undefined, "user-a");
    vi.setSystemTime(2_000);
    await linerDb.putTrack(track("mid"));
    await linerDb.putAudio("mid", blob, "audio/ogg", undefined, "user-a");
    await linerDb.putTrack(track("legacy"));
    await linerDb.putAudio("legacy", blob, "audio/ogg");
    await linerDb.putAudio("orphan", blob, "audio/ogg", undefined, "user-a");
    await linerDb.putTrack(track("queued"));
    restart();

    expect((await linerDb.getDownloadedTracks("user-a")).map((t) => t.id)).toEqual(["new", "mid", "old"]);

    vi.setSystemTime(5_000);
    await linerDb.touchAudio("old");
    restart();
    expect((await linerDb.getDownloadedTracks("user-a")).map((t) => t.id)[0]).toBe("old");
  });

  it("keeps earlier owners after a restart when another account re-downloads the file", async () => {
    await linerDb.putTrack(track("song"));
    await linerDb.putAudio("song", new Blob(["x"]), "audio/ogg", undefined, "user-a");
    restart();
    await linerDb.putAudio("song", new Blob(["xy"]), "audio/ogg", undefined, "user-b");
    restart();

    expect((await linerDb.getAudio("song"))?.ownerIds).toEqual(["user-a", "user-b"]);
    restart();
    expect((await linerDb.getDownloadedTracks("user-a")).map((t) => t.id)).toEqual(["song"]);
    expect((await linerDb.getDownloadedTracks("user-b")).map((t) => t.id)).toEqual(["song"]);
  });

  it("persists a second owner added on playback", async () => {
    await linerDb.putTrack(track("song"));
    await linerDb.putAudio("song", new Blob(["x"]), "audio/ogg", undefined, "user-a");
    restart();
    await linerDb.addAudioOwner("song", "user-b");
    restart();

    expect((await linerDb.getAudio("song"))?.ownerIds).toEqual(["user-a", "user-b"]);
  });

  it("forgets a track once its audio is evicted", async () => {
    await linerDb.putTrack(track("song"));
    await linerDb.putAudio("song", new Blob(["x"]), "audio/ogg", undefined, "user-a");
    await linerDb.deleteAudio("song");
    restart();
    expect(await linerDb.getDownloadedTracks("user-a")).toEqual([]);
  });
});
