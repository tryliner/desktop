import { create } from "zustand";
import {
  EMPTY_DOWNLOADS,
  accountKey,
  persist,
  readPersisted,
  toPinnedTrack,
} from "./downloadsPersistence";
import type {
  AccountDownloads,
  DownloadProgress,
  PinnedCollection,
  PinnedTrack,
} from "./downloadsTypes";

export * from "./downloadsTypes";
export { accountKey, toPinnedTrack } from "./downloadsPersistence";
export { ESTIMATED_BYTES_PER_MS, estimateBytes } from "./downloadsEstimate";
export { pinnedTrackList } from "./pinnedTrackList";

interface DownloadsState {
  byAccount: Record<string, AccountDownloads>;
  active: DownloadProgress | null;
  queued: string[];
  failed: string[];

  pinTracks: (tracks: PinnedTrack[]) => void;
  unpinTracks: (trackIds: string[]) => void;
  pinCollection: (collection: Omit<PinnedCollection, "pinnedAt">) => void;
  unpinCollection: (id: string) => void;
  updateCollectionTracks: (id: string, tracks: PinnedTrack[]) => void;
}

function updateAccount(
  state: DownloadsState,
  change: (current: AccountDownloads) => AccountDownloads,
): Partial<DownloadsState> {
  const account = accountKey();
  if (!account) return {};
  const before = state.byAccount[account] ?? EMPTY_DOWNLOADS;
  const after = change(before);
  if (after === before) return {};
  const byAccount = { ...state.byAccount, [account]: after };
  persist(byAccount);
  return { byAccount };
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  byAccount: typeof localStorage !== "undefined" ? readPersisted() : {},
  active: null,
  queued: [],
  failed: [],

  pinTracks: (tracks) =>
    set((state) =>
      updateAccount(state, (current) => {
        const next = { ...current.tracks };
        const now = Date.now();
        for (const track of tracks) {
          if (!track.id || track.id.startsWith("local:")) continue;
          next[track.id] = { ...toPinnedTrack(track), pinnedAt: now };
        }
        return { ...current, tracks: next };
      }),
    ),

  unpinTracks: (trackIds) =>
    set((state) =>
      updateAccount(state, (current) => {
        const next = { ...current.tracks };
        for (const id of trackIds) delete next[id];
        return { ...current, tracks: next };
      }),
    ),

  pinCollection: (collection) =>
    set((state) =>
      updateAccount(state, (current) => ({
        ...current,
        collections: {
          ...current.collections,
          [collection.id]: {
            ...collection,
            tracks: collection.tracks
              .filter((track) => !track.id.startsWith("local:"))
              .map(toPinnedTrack),
            pinnedAt: Date.now(),
          },
        },
      })),
    ),

  unpinCollection: (id) =>
    set((state) =>
      updateAccount(state, (current) => {
        if (!current.collections[id]) return current;
        const collections = { ...current.collections };
        delete collections[id];
        return { ...current, collections };
      }),
    ),

  updateCollectionTracks: (id, tracks) =>
    set((state) =>
      updateAccount(state, (current) => {
        const existing = current.collections[id];
        if (!existing) return current;
        const same =
          existing.tracks.length === tracks.length &&
          existing.tracks.every((track, i) => track.id === tracks[i]?.id);
        if (same) return current;
        return {
          ...current,
          collections: {
            ...current.collections,
            [id]: {
              ...existing,
              tracks: tracks
                .filter((track) => !track.id.startsWith("local:"))
                .map(toPinnedTrack),
            },
          },
        };
      }),
    ),
}));

export function currentDownloads(
  state: Pick<DownloadsState, "byAccount"> = useDownloadsStore.getState(),
): AccountDownloads {
  const account = accountKey();
  return (account && state.byAccount[account]) || EMPTY_DOWNLOADS;
}

export function pinnedCollectionSnapshot(id: string): PinnedCollection | null {
  return currentDownloads().collections[id] ?? null;
}
