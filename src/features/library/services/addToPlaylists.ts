import { api, ApiError, type ApiUserPlaylistItem } from "@/shared/api";
import { clientCatalog } from "@/shared/api/clientCatalog";
import type { Track } from "@/shared/contracts";
import { isLocalTrackId } from "@/shared/media/local";
import { notifyLibraryChanged } from "../hooks/usePlaylists";
import { chunk, dedupeById, mapLimit } from "./batching";
import { createdItems } from "./recoverAddedItems";

import type {
  AddableTrack,
  AddedItem,
  AddToPlaylistsResult,
  UndoResult,
} from "./addToPlaylistsTypes";

export type {
  AddableTrack,
  AddedItem,
  AddToPlaylistsResult,
  UndoResult,
} from "./addToPlaylistsTypes";

export interface AddToPlaylistsDeps {
  resolveSnapshot: (id: string) => Promise<Track | undefined>;
  addSnapshots: typeof api.addPlaylistTrackSnapshots;
  addOne: typeof api.addPlaylistTrack;
  removeItem: typeof api.removePlaylistItem;
  listItems: (playlistId: string) => Promise<ApiUserPlaylistItem[]>;
  now: () => number;
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
  listItems: async (playlistId) =>
    (await api.getUserPlaylist(playlistId)).items,
  now: () => Date.now(),
  notify: notifyLibraryChanged,
};

const SNAPSHOT_CONCURRENCY = 6;
const BATCH_SIZE = 24;

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

async function sendBatch(
  batch: AddableTrack[],
  targets: string[],
  result: AddToPlaylistsResult,
  touched: Set<string>,
  deps: AddToPlaylistsDeps,
): Promise<void> {
  const snapshots = await mapLimit(batch, SNAPSHOT_CONCURRENCY, (track) =>
    deps.resolveSnapshot(track.id).catch(() => undefined),
  );
  const resolved = snapshots.filter((s): s is Track => Boolean(s));
  const unresolved = batch.filter((_, index) => !snapshots[index]);
  await Promise.all(
    targets.map(async (playlistId) => {
      if (resolved.length > 0) {
        try {
          const startedAt = deps.now();
          const res = await deps.addSnapshots(playlistId, resolved);
          result.added += res.added;
          result.alreadyIn += res.rejected;
          const created = await createdItems(
            res,
            resolved.map((t) => t.id),
            startedAt,
            () => deps.listItems(playlistId),
          );
          result.items.push(...itemsFrom(playlistId, created));
          if (res.added > 0) touched.add(playlistId);
        } catch {
          result.failed += resolved.length;
        }
      }
      for (const track of unresolved) {
        try {
          const item = await deps.addOne(playlistId, track.id);
          result.added += 1;
          result.items.push(...itemsFrom(playlistId, [item]));
          touched.add(playlistId);
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            result.alreadyIn += 1;
          } else {
            result.failed += 1;
          }
        }
      }
    }),
  );
}

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

  const touched = new Set<string>();
  for (const batch of chunk(cloud, BATCH_SIZE)) {
    await sendBatch(batch, targets, result, touched, deps);
  }
  result.playlistsTouched = targets.filter((id) => touched.has(id));
  if (result.added > 0) deps.notify();
  return result;
}

export async function undoAddToPlaylists(
  items: AddedItem[],
  deps: AddToPlaylistsDeps = defaultDeps,
): Promise<UndoResult> {
  if (items.length === 0) return { removed: 0, failed: [] };
  const settled = await Promise.allSettled(
    items.map((item) => deps.removeItem(item.playlistId, item.itemId)),
  );
  const failed = items.filter((_, i) => settled[i].status === "rejected");
  const removed = items.length - failed.length;
  if (removed > 0) deps.notify();
  return { removed, failed };
}
