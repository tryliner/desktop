import type { Track } from "@/shared/types";
import { api, getAuthSession } from "@/shared/api";

export interface OfflinePlaylist {
  id: string; // "offline_pl_..."
  title: string;
  description?: string;
  tracks: Track[];
  coverUrls: string[];
  coverUrl: string;
  createdAt: string;
  updatedAt: string;
  isOffline: true;
}

const STORAGE_KEY = "liner:offline_playlists";

function extractCoversFromTracks(tracks: Track[]): string[] {
  const urls: string[] = [];
  for (const track of tracks) {
    if (track.coverUrl && !urls.includes(track.coverUrl)) {
      urls.push(track.coverUrl);
      if (urls.length >= 4) break;
    }
  }
  return urls;
}

export function getOfflinePlaylists(): OfflinePlaylist[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({
      ...p,
      isOffline: true,
      tracks: Array.isArray(p.tracks) ? p.tracks : [],
      coverUrls: Array.isArray(p.coverUrls) ? p.coverUrls : [],
      coverUrl: p.coverUrl || (p.coverUrls && p.coverUrls[0]) || "",
    }));
  } catch (err) {
    console.error("[offlinePlaylists] Failed to read offline playlists:", err);
    return [];
  }
}

export function saveOfflinePlaylists(playlists: OfflinePlaylist[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    window.dispatchEvent(new Event("library:changed"));
  } catch (err) {
    console.error("[offlinePlaylists] Failed to save offline playlists:", err);
  }
}

export function getOfflinePlaylist(id: string): OfflinePlaylist | null {
  const list = getOfflinePlaylists();
  return list.find((p) => p.id === id) ?? null;
}

export function createOfflinePlaylist(
  title: string,
  description?: string,
  initialTrack?: Partial<Track> & { id: string; title: string } | null,
): OfflinePlaylist {
  const list = getOfflinePlaylists();
  const id = `offline_pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const tracks: Track[] = [];
  if (initialTrack) {
    tracks.push({
      id: initialTrack.id,
      title: initialTrack.title,
      artists: initialTrack.artists || "",
      artistId: initialTrack.artistId,
      artistList: initialTrack.artistList,
      album: initialTrack.album,
      coverUrl: initialTrack.coverUrl || "",
      durationMs: initialTrack.durationMs || 0,
      explicit: initialTrack.explicit,
      playCount: 0,
      playlistItemId: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });
  }

  const covers = extractCoversFromTracks(tracks);

  const newPlaylist: OfflinePlaylist = {
    id,
    title: title.trim(),
    description: description?.trim() || undefined,
    tracks,
    coverUrls: covers,
    coverUrl: covers[0] || "",
    createdAt: now,
    updatedAt: now,
    isOffline: true,
  };

  list.unshift(newPlaylist);
  saveOfflinePlaylists(list);
  return newPlaylist;
}

export function updateOfflinePlaylist(
  id: string,
  updates: { title?: string; description?: string },
): OfflinePlaylist | null {
  const list = getOfflinePlaylists();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const target = list[index];
  const updated: OfflinePlaylist = {
    ...target,
    title: updates.title !== undefined ? updates.title.trim() : target.title,
    description: updates.description !== undefined ? updates.description.trim() || undefined : target.description,
    updatedAt: new Date().toISOString(),
  };

  list[index] = updated;
  saveOfflinePlaylists(list);
  return updated;
}

export function addTrackToOfflinePlaylist(
  id: string,
  track: Partial<Track> & { id: string; title: string },
): OfflinePlaylist | null {
  const list = getOfflinePlaylists();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const target = list[index];
  // Check if track is already in this offline playlist
  const exists = target.tracks.some((t) => t.id === track.id);
  if (exists) return null;

  const newTrack: Track = {
    id: track.id,
    title: track.title,
    artists: track.artists || "",
    artistId: track.artistId,
    artistList: track.artistList,
    album: track.album,
    coverUrl: track.coverUrl || "",
    durationMs: track.durationMs || 0,
    explicit: track.explicit,
    playCount: 0,
    playlistItemId: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  const newTracks = [...target.tracks, newTrack];
  const covers = extractCoversFromTracks(newTracks);

  const updated: OfflinePlaylist = {
    ...target,
    tracks: newTracks,
    coverUrls: covers,
    coverUrl: covers[0] || "",
    updatedAt: new Date().toISOString(),
  };

  list[index] = updated;
  saveOfflinePlaylists(list);
  return updated;
}

export function removeTrackFromOfflinePlaylist(
  id: string,
  playlistItemIdOrTrackId: string,
): OfflinePlaylist | null {
  const list = getOfflinePlaylists();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const target = list[index];
  const newTracks = target.tracks.filter(
    (t) => t.playlistItemId !== playlistItemIdOrTrackId && t.id !== playlistItemIdOrTrackId,
  );
  const covers = extractCoversFromTracks(newTracks);

  const updated: OfflinePlaylist = {
    ...target,
    tracks: newTracks,
    coverUrls: covers,
    coverUrl: covers[0] || "",
    updatedAt: new Date().toISOString(),
  };

  list[index] = updated;
  saveOfflinePlaylists(list);
  return updated;
}

export function reorderOfflinePlaylistTracks(
  id: string,
  itemId: string,
  beforeItemId: string | null,
): OfflinePlaylist | null {
  const list = getOfflinePlaylists();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const target = list[index];
  const fromIndex = target.tracks.findIndex(
    (t) => t.playlistItemId === itemId || t.id === itemId,
  );
  if (fromIndex === -1) return target;

  const nextTracks = [...target.tracks];
  const [moved] = nextTracks.splice(fromIndex, 1);

  if (beforeItemId === null) {
    nextTracks.push(moved);
  } else {
    const toIndex = nextTracks.findIndex(
      (t) => t.playlistItemId === beforeItemId || t.id === beforeItemId,
    );
    if (toIndex === -1) {
      nextTracks.push(moved);
    } else {
      nextTracks.splice(toIndex, 0, moved);
    }
  }

  const covers = extractCoversFromTracks(nextTracks);
  const updated: OfflinePlaylist = {
    ...target,
    tracks: nextTracks,
    coverUrls: covers,
    coverUrl: covers[0] || "",
    updatedAt: new Date().toISOString(),
  };

  list[index] = updated;
  saveOfflinePlaylists(list);
  return updated;
}

export function deleteOfflinePlaylist(id: string): boolean {
  const list = getOfflinePlaylists();
  const filtered = list.filter((p) => p.id !== id);
  if (filtered.length === list.length) return false;
  saveOfflinePlaylists(filtered);
  return true;
}

export async function syncOfflinePlaylistToServer(
  id: string,
): Promise<{ serverPlaylistId: string; title: string }> {
  const playlist = getOfflinePlaylist(id);
  if (!playlist) {
    throw new Error("Offline playlist not found");
  }

  const session = getAuthSession();
  if (!session?.accessToken) {
    throw new Error("You must be logged in to sync playlists to the server");
  }

  if (playlist.tracks.some((t) => t.id.startsWith("local_"))) {
    throw new Error("Playlists containing local files cannot be synced to the server");
  }

  // 1. Create playlist on the server
  const created = await api.createPlaylist({
    title: playlist.title,
    description: playlist.description,
  });

  // 2. Add tracks to server playlist (excluding local-only files)
  for (const track of playlist.tracks) {
    if (!track.id.startsWith("local_")) {
      try {
        await api.addPlaylistTrack(created.id, track.id);
      } catch (err) {
        console.warn(`[syncOfflinePlaylist] Failed to add track ${track.id}:`, err);
      }
    }
  }

  // 3. Remove offline copy now that it's in the cloud
  deleteOfflinePlaylist(id);

  return {
    serverPlaylistId: created.id,
    title: created.title || playlist.title,
  };
}

export function updateTrackInOfflinePlaylists(track: Track): void {
  const list = getOfflinePlaylists();
  let changed = false;
  for (const pl of list) {
    const idx = pl.tracks.findIndex((t) => t.id === track.id);
    if (idx !== -1) {
      pl.tracks[idx] = {
        ...pl.tracks[idx],
        title: track.title,
        artists: track.artists,
        album: track.album,
        coverUrl: track.coverUrl,
      };
      pl.coverUrls = extractCoversFromTracks(pl.tracks);
      pl.coverUrl = pl.coverUrls[0] || "";
      pl.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) {
    saveOfflinePlaylists(list);
  }
}
