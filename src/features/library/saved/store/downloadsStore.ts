import { create } from "zustand";
import { getAuthSession } from "@/shared/api";
import type { Track } from "@/shared/types";

/**
 * What the user chose to download, on top of "save liked songs": single
 * songs, and whole playlists or albums (which follow the playlist as it
 * changes). Kept per account so signing in as someone else doesn't mix lists.
 * The files themselves live in the saved-tracks library; this is only the
 * list of reasons to keep them.
 */

export const DOWNLOADS_KEY = "liner_downloads_v1";

export type PinnedTrack = Pick<
  Track,
  "id" | "title" | "artists" | "coverUrl" | "durationMs"
> &
  Partial<Pick<Track, "explicit" | "artistId">>;

export type CollectionKind = "playlist" | "album";

export interface PinnedCollection {
  id: string;
  kind: CollectionKind;
  title: string;
  coverUrl: string;
  tracks: PinnedTrack[];
  pinnedAt: number;
}

export interface AccountDownloads {
  tracks: Record<string, PinnedTrack & { pinnedAt: number }>;
  collections: Record<string, PinnedCollection>;
}

export interface DownloadProgress {
  trackId: string;
  received: number;
  total: number | null;
}

interface DownloadsState {
  byAccount: Record<string, AccountDownloads>;
  /** the song being downloaded right now (not persisted) */
  active: DownloadProgress | null;
  /** waiting in line, in order (not persisted, mirrored from the sync) */
  queued: string[];
  /** gave up after several attempts; can be retried */
  failed: string[];

  pinTracks: (tracks: PinnedTrack[]) => void;
  unpinTracks: (trackIds: string[]) => void;
  pinCollection: (collection: Omit<PinnedCollection, "pinnedAt">) => void;
  unpinCollection: (id: string) => void;
  /** a pinned playlist changed: songs added are fetched, removed ones let go */
  updateCollectionTracks: (id: string, tracks: PinnedTrack[]) => void;
}

const EMPTY: AccountDownloads = { tracks: {}, collections: {} };

function accountKey(): string | null {
  return getAuthSession()?.user?.id ?? null;
}

export function toPinnedTrack(track: PinnedTrack): PinnedTrack {
  return {
    id: track.id,
    title: track.title,
    artists: track.artists,
    coverUrl: track.coverUrl,
    durationMs: track.durationMs,
    ...(track.explicit ? { explicit: true } : {}),
    ...(track.artistId ? { artistId: track.artistId } : {}),
  };
}

function readPersisted(): Record<string, AccountDownloads> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(DOWNLOADS_KEY) ?? "{}",
    );
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, AccountDownloads> = {};
    for (const [account, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const raw = value as Partial<AccountDownloads>;
      out[account] = {
        tracks: raw.tracks && typeof raw.tracks === "object" ? raw.tracks : {},
        collections:
          raw.collections && typeof raw.collections === "object"
            ? raw.collections
            : {},
      };
    }
    return out;
  } catch {
    return {};
  }
}

function persist(byAccount: Record<string, AccountDownloads>) {
  try {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(byAccount));
  } catch {}
}

function updateAccount(
  state: DownloadsState,
  change: (current: AccountDownloads) => AccountDownloads,
): Partial<DownloadsState> {
  const account = accountKey();
  if (!account) return {};
  const before = state.byAccount[account] ?? EMPTY;
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
  return (account && state.byAccount[account]) || EMPTY;
}

/** every song with a reason to be downloaded: single pins first, then collections */
export function pinnedTrackList(downloads: AccountDownloads): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  const add = (track: PinnedTrack) => {
    if (seen.has(track.id)) return;
    seen.add(track.id);
    out.push({ ...track, playCount: 0 });
  };
  Object.values(downloads.tracks)
    .sort((a, b) => b.pinnedAt - a.pinnedAt)
    .forEach(add);
  Object.values(downloads.collections)
    .sort((a, b) => b.pinnedAt - a.pinnedAt)
    .forEach((collection) => collection.tracks.forEach(add));
  return out;
}

/** rough size before downloading: ~160 kbps, what most streams come in at */
export const ESTIMATED_BYTES_PER_MS = 160_000 / 8 / 1000;

export function estimateBytes(tracks: Pick<Track, "durationMs">[]): number {
  return Math.round(
    tracks.reduce(
      (sum, track) => sum + Math.max(0, track.durationMs || 210_000),
      0,
    ) * ESTIMATED_BYTES_PER_MS,
  );
}

/** a downloaded playlist/album as last seen, so its page opens offline */
export function pinnedCollectionSnapshot(id: string): PinnedCollection | null {
  return currentDownloads().collections[id] ?? null;
}
