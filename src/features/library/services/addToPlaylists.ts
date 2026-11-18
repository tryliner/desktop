import { api, ApiError, type ApiUserPlaylistItem } from "@/shared/api";
import { clientCatalog } from "@/shared/api/clientCatalog";
import type { Track } from "@/shared/contracts";
import { isLocalTrackId } from "@/shared/media/local";
import { notifyLibraryChanged } from "../hooks/usePlaylists";

/** minimal shape callers already have for a track row */
export interface AddableTrack {
  id: string;
  title: string;
}

export interface AddedItem {
  playlistId: string;
  itemId: string;
  trackId: string;
}

export interface AddToPlaylistsResult {
  /** playlists that received at least one new track */
  playlistsTouched: string[];
  added: number;
  alreadyIn: number;
  failed: number;
  /** local files can't live in a server playlist */
  skippedLocal: number;
  items: AddedItem[];
}

export interface AddToPlaylistsDeps {
  resolveSnapshot: (id: string) => Promise<Track | undefined>;
  addSnapshots: typeof api.addPlaylistTrackSnapshots;
  addOne: typeof api.addPlaylistTrack;
  removeItem: typeof api.removePlaylistItem;
  notify: () => void;
}

const defaultDeps: AddToPlaylistsDeps = {
  resolveSnapshot: (id) => clientCatalog.resolveSnapshot(id),
  addSnapshots: (playlistId, tracks) =>
    api.addPlaylistTrackSnapshots(playlistId, tracks),
  addOne: (playlistId, trackId, snapshot) =>
    api.addPlaylistTrack(playlistId, trackId, snapshot),
  removeItem: (playlistId, itemId) =>
    api.removePlaylistItem(playlistId, itemId),
  notify: notifyLibraryChanged,
};

const SNAPSHOT_CONCURRENCY = 6;

async function mapLimit<T, R>(
  input: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = Array.from({ length: input.length });
  let next = 0;
  const worker = async () => {
    while (next < input.length) {
      const index = next++;
      out[index] = await fn(input[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, input.length) }, worker),
  );
  return out;
}

function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function itemsFrom(
  playlistId: string,
  items: ApiUserPlaylistItem[],
): AddedItem[] {
  return items.map((item) => ({
    playlistId,
    itemId: item.id,
    trackId: item.track.id,
  }));
}

/**
 * Adds every track to every playlist with one bulk request per playlist and
 * a single library refresh at the end (the per-track hook reloaded the whole
 * library once per call). Tracks whose snapshot can't be resolved on the
 * client fall back to the single-track endpoint, which resolves server side.
 */
export async function addTracksToPlaylists(
  tracks: AddableTrack[],
  playlistIds: string[],
  deps: AddToPlaylistsDeps = defaultDeps,
): Promise<AddToPlaylistsResult> {
  const unique = dedupeById(tracks);
  const cloud = unique.filter((track) => !isLocalTrackId(track.id));
  const result: AddToPlaylistsResult = {
    playlistsTouched: [],
    added: 0,
    alreadyIn: 0,
    failed: 0,
    skippedLocal: unique.length - cloud.length,
    items: [],
  };
  const targets = [...new Set(playlistIds)];
  if (cloud.length === 0 || targets.length === 0) return result;

  const snapshots = await mapLimit(cloud, SNAPSHOT_CONCURRENCY, (track) =>
    deps.resolveSnapshot(track.id).catch(() => undefined),
  );
  const resolved: Track[] = [];
  const unresolved: AddableTrack[] = [];
  cloud.forEach((track, index) => {
    const snapshot = snapshots[index];
    if (snapshot) resolved.push(snapshot);
    else unresolved.push(track);
  });

  await Promise.all(
    targets.map(async (playlistId) => {
      let touched = false;
      if (resolved.length > 0) {
        try {
          const res = await deps.addSnapshots(playlistId, resolved);
          result.added += res.added;
          result.alreadyIn += res.rejected;
          result.items.push(...itemsFrom(playlistId, res.items));
          touched ||= res.added > 0;
        } catch {
          result.failed += resolved.length;
        }
      }
      for (const track of unresolved) {
        try {
          const item = await deps.addOne(playlistId, track.id);
          result.added += 1;
          result.items.push(...itemsFrom(playlistId, [item]));
          touched = true;
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            result.alreadyIn += 1;
          } else {
            result.failed += 1;
          }
        }
      }
      if (touched) result.playlistsTouched.push(playlistId);
    }),
  );

  if (result.added > 0) deps.notify();
  return result;
}

/** reverts an add by deleting exactly the items it created */
export async function undoAddToPlaylists(
  items: AddedItem[],
  deps: AddToPlaylistsDeps = defaultDeps,
): Promise<void> {
  if (items.length === 0) return;
  await Promise.allSettled(
    items.map((item) => deps.removeItem(item.playlistId, item.itemId)),
  );
  deps.notify();
}

// ---------------------------------------------------------------------------
// recently used playlists, shown first in the picker and in the quick submenu

const RECENT_KEY = "liner_recent_playlists_v1";
const RECENT_MAX = 5;
const recentListeners = new Set<() => void>();

export function readRecentPlaylists(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed
          .filter((v): v is string => typeof v === "string")
          .slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function rememberRecentPlaylists(ids: string[]): void {
  if (ids.length === 0 || typeof localStorage === "undefined") return;
  const next = [...new Set([...ids, ...readRecentPlaylists()])].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  recentListeners.forEach((listener) => listener());
}

export function subscribeRecentPlaylists(listener: () => void): () => void {
  recentListeners.add(listener);
  return () => recentListeners.delete(listener);
}

/** orders playlists so recently used ones come first, keeping the rest stable */
export function sortByRecent<T extends { id: string }>(
  playlists: T[],
  recent: string[] = readRecentPlaylists(),
): T[] {
  const rank = new Map(recent.map((id, index) => [id, index]));
  return playlists
    .map((playlist, index) => ({ playlist, index }))
    .sort((a, b) => {
      const ra = rank.get(a.playlist.id) ?? Infinity;
      const rb = rank.get(b.playlist.id) ?? Infinity;
      return ra === rb ? a.index - b.index : ra - rb;
    })
    .map(({ playlist }) => playlist);
}
