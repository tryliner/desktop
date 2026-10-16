import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cachedRecordToTrack, loadDownloadedTracks } from "./useDownloadedTracks";
import { linerDb } from "@/shared/storage";
import { setAuthSession } from "@/shared/api/auth-session";

const signIn = (id: string) =>
  setAuthSession({
    accessToken: "a",
    refreshToken: "r",
    accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id },
  });

describe("loadDownloadedTracks", () => {
  beforeEach(async () => {
    await linerDb.clearAll();
    const blob = new Blob(["x"], { type: "audio/ogg" });
    for (const [id, owner] of [["a1", "user-a"], ["b1", "user-b"]]) {
      await linerDb.putTrack({ id, title: id, artists: "A", durationMs: 1, coverUrl: "", playCount: 0 });
      await linerDb.putAudio(id, blob, "audio/ogg", undefined, owner);
    }
  });

  afterEach(() => {
    setAuthSession(null);
  });

  it("lists only the signed-in account's tracks", async () => {
    signIn("user-a");
    expect((await loadDownloadedTracks()).map((t) => t.id)).toEqual(["a1"]);
    signIn("user-b");
    expect((await loadDownloadedTracks()).map((t) => t.id)).toEqual(["b1"]);
  });

  it("lists nothing when signed out", async () => {
    setAuthSession(null);
    expect(await loadDownloadedTracks()).toEqual([]);
  });
});

describe("cachedRecordToTrack", () => {
  it("maps a cached record to a playable track", () => {
    const track = cachedRecordToTrack({
      id: "t1",
      title: "Song",
      artists: "Artist",
      albumId: "al1",
      albumTitle: "Album",
      coverUrl: "https://covers.example/c.jpg",
      durationMs: 1234,
      savedAt: 1,
    });
    expect(track).toEqual({
      id: "t1",
      title: "Song",
      artists: "Artist",
      coverUrl: "https://covers.example/c.jpg",
      durationMs: 1234,
      playCount: 0,
      album: { id: "al1", title: "Album" },
    });
  });

  it("fills missing optional fields", () => {
    const track = cachedRecordToTrack({
      id: "t2",
      title: "Song",
      artists: "Artist",
      durationMs: 0,
      savedAt: 1,
    });
    expect(track.coverUrl).toBe("");
    expect(track.album).toBeUndefined();
  });
});
