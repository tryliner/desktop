import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOfflinePlaylists,
  getOfflinePlaylist,
  createOfflinePlaylist,
  updateOfflinePlaylist,
  addTrackToOfflinePlaylist,
  removeTrackFromOfflinePlaylist,
  reorderOfflinePlaylistTracks,
  deleteOfflinePlaylist,
  syncOfflinePlaylistToServer,
} from "./offlinePlaylists";
import * as apiModule from "@/shared/api";

describe("offlinePlaylists", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates and retrieves an offline playlist", () => {
    const pl = createOfflinePlaylist("My Offline Jams", "Best songs ever");
    expect(pl.id.startsWith("offline_pl_")).toBe(true);
    expect(pl.title).toBe("My Offline Jams");
    expect(pl.description).toBe("Best songs ever");
    expect(pl.isOffline).toBe(true);
    expect(pl.tracks).toEqual([]);

    const all = getOfflinePlaylists();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(pl.id);

    const fetched = getOfflinePlaylist(pl.id);
    expect(fetched?.title).toBe("My Offline Jams");
  });

  it("creates an offline playlist with an initial track", () => {
    const pl = createOfflinePlaylist("Track Initialized", undefined, {
      id: "trk_1",
      title: "Song 1",
      artists: "Artist 1",
      coverUrl: "https://example.com/cover1.jpg",
      durationMs: 200000,
    });

    expect(pl.tracks.length).toBe(1);
    expect(pl.tracks[0].id).toBe("trk_1");
    expect(pl.tracks[0].playlistItemId).toBeDefined();
    expect(pl.coverUrl).toBe("https://example.com/cover1.jpg");
    expect(pl.coverUrls).toEqual(["https://example.com/cover1.jpg"]);
  });

  it("updates title and description", () => {
    const pl = createOfflinePlaylist("Old Title", "Old Desc");
    const updated = updateOfflinePlaylist(pl.id, {
      title: "New Title",
      description: "New Desc",
    });

    expect(updated?.title).toBe("New Title");
    expect(updated?.description).toBe("New Desc");

    const reloaded = getOfflinePlaylist(pl.id);
    expect(reloaded?.title).toBe("New Title");
  });

  it("adds tracks and prevents duplicates", () => {
    const pl = createOfflinePlaylist("Favorites");
    const added1 = addTrackToOfflinePlaylist(pl.id, {
      id: "trk_a",
      title: "Track A",
      artists: "Artist A",
      coverUrl: "https://cover.a",
    });
    expect(added1?.tracks.length).toBe(1);

    // Duplicate track should return null
    const dup = addTrackToOfflinePlaylist(pl.id, {
      id: "trk_a",
      title: "Track A",
    });
    expect(dup).toBeNull();

    const added2 = addTrackToOfflinePlaylist(pl.id, {
      id: "trk_b",
      title: "Track B",
      artists: "Artist B",
      coverUrl: "https://cover.b",
    });
    expect(added2?.tracks.length).toBe(2);
    expect(added2?.coverUrls).toEqual(["https://cover.a", "https://cover.b"]);
  });

  it("removes a track by playlistItemId", () => {
    const pl = createOfflinePlaylist("Favorites");
    const withTrack = addTrackToOfflinePlaylist(pl.id, {
      id: "trk_a",
      title: "Track A",
    });
    const itemId = withTrack!.tracks[0].playlistItemId!;

    const afterRemove = removeTrackFromOfflinePlaylist(pl.id, itemId);
    expect(afterRemove?.tracks.length).toBe(0);
  });

  it("reorders tracks in offline playlist", () => {
    const pl = createOfflinePlaylist("Order test");
    addTrackToOfflinePlaylist(pl.id, { id: "1", title: "One" });
    addTrackToOfflinePlaylist(pl.id, { id: "2", title: "Two" });
    const p3 = addTrackToOfflinePlaylist(pl.id, { id: "3", title: "Three" });

    const item3Id = p3!.tracks[2].playlistItemId!;
    const item1Id = p3!.tracks[0].playlistItemId!;

    // Move item 3 to before item 1
    const reordered = reorderOfflinePlaylistTracks(pl.id, item3Id, item1Id);
    expect(reordered?.tracks.map((t) => t.id)).toEqual(["3", "1", "2"]);
  });

  it("deletes offline playlist", () => {
    const pl = createOfflinePlaylist("To Delete");
    expect(deleteOfflinePlaylist(pl.id)).toBe(true);
    expect(getOfflinePlaylist(pl.id)).toBeNull();
  });

  it("syncs offline playlist to server and removes offline copy", async () => {
    const pl = createOfflinePlaylist("Cloud Bound", "Ready to sync", {
      id: "trk_cloud_1",
      title: "Cloud Song",
      artists: "Artist",
      coverUrl: "https://cloud.cover",
    });

    vi.spyOn(apiModule, "getAuthSession").mockReturnValue({
      accessToken: "mock-token",
      user: { id: "u1", name: "User" } as any,
    } as any);

    const mockCreatePlaylist = vi.fn().mockResolvedValue({
      id: "server_pl_999",
      title: "Cloud Bound",
    });
    const mockAddTrack = vi.fn().mockResolvedValue({});

    (apiModule.api as any).createPlaylist = mockCreatePlaylist;
    (apiModule.api as any).addPlaylistTrack = mockAddTrack;

    const result = await syncOfflinePlaylistToServer(pl.id);
    expect(result.serverPlaylistId).toBe("server_pl_999");
    expect(mockCreatePlaylist).toHaveBeenCalledWith({
      title: "Cloud Bound",
      description: "Ready to sync",
    });
    expect(mockAddTrack).toHaveBeenCalledWith("server_pl_999", "trk_cloud_1");

    // Offline copy was removed
    expect(getOfflinePlaylist(pl.id)).toBeNull();
  });

  it("rejects syncing offline playlists that contain local audio files", async () => {
    const pl = createOfflinePlaylist("Local Only");
    addTrackToOfflinePlaylist(pl.id, {
      id: "local_12345_audio",
      title: "My Local Song",
      artists: "Local Artist",
    });

    vi.spyOn(apiModule, "getAuthSession").mockReturnValue({
      accessToken: "mock-token",
      user: { id: "u1", name: "User" } as any,
    } as any);

    await expect(syncOfflinePlaylistToServer(pl.id)).rejects.toThrow(
      "Playlists containing local files cannot be synced to the server",
    );

    // Playlist remains untouched
    expect(getOfflinePlaylist(pl.id)).not.toBeNull();
  });
});
