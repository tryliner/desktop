import { describe, it, expect, beforeEach } from "vitest";
import {
  readRecentPlaylists,
  rememberRecentPlaylists,
  resetRecentPlaylistsCache,
  sortByRecent,
} from "./recentPlaylists";

describe("recent playlists", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRecentPlaylistsCache();
  });

  it("keeps the five most recent, newest first, without repeats", () => {
    rememberRecentPlaylists(["a", "b"]);
    rememberRecentPlaylists(["c"]);
    rememberRecentPlaylists(["a", "d", "e", "f"]);
    expect(readRecentPlaylists()).toEqual(["a", "d", "e", "f", "c"]);
  });

  it("returns the same array until the list changes", () => {
    rememberRecentPlaylists(["a"]);
    const first = readRecentPlaylists();
    expect(readRecentPlaylists()).toBe(first);
    rememberRecentPlaylists(["b"]);
    expect(readRecentPlaylists()).not.toBe(first);
  });

  it("survives junk in storage", () => {
    localStorage.setItem("liner_recent_playlists_v1", "{nope");
    expect(readRecentPlaylists()).toEqual([]);
  });

  it("sorts recent ones first and keeps the rest in order", () => {
    const list = ["a", "b", "c", "d"].map((id) => ({ id }));
    expect(sortByRecent(list, ["c", "a"]).map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });
});
