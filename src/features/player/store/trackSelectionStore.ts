import { create } from "zustand";
import type { Track } from "@/shared/types";

/** what a selected row needs for bulk actions */
export type SelectableTrack = Pick<
  Track,
  "id" | "title" | "artists" | "coverUrl" | "durationMs"
> & { playlistItemId?: string };

export interface SelectionScopeMeta {
  /** set when the list is one of the user's own playlists (enables Remove) */
  playlistId?: string;
  playlistTitle?: string;
}

/** a row key: playlist items can repeat a track, so prefer the item id */
export function selectionKey(track: SelectableTrack): string {
  return track.playlistItemId ?? track.id;
}

export interface TrackSelectionState {
  /** the list the selection belongs to; selecting in another list resets it */
  scope: string | null;
  meta: SelectionScopeMeta;
  /** selected row keys, in list order */
  keys: string[];
  tracks: Record<string, SelectableTrack>;
  /** last plainly toggled row, the start of a Shift range */
  anchor: string | null;

  toggle: (
    scope: string,
    meta: SelectionScopeMeta,
    ordered: SelectableTrack[],
    track: SelectableTrack,
  ) => void;
  selectRange: (
    scope: string,
    meta: SelectionScopeMeta,
    ordered: SelectableTrack[],
    track: SelectableTrack,
  ) => void;
  selectAll: (
    scope: string,
    meta: SelectionScopeMeta,
    ordered: SelectableTrack[],
  ) => void;
  clear: () => void;
}

function ordering(ordered: SelectableTrack[]): Map<string, number> {
  return new Map(ordered.map((track, index) => [selectionKey(track), index]));
}

function sortKeys(keys: Iterable<string>, order: Map<string, number>) {
  return [...keys]
    .filter((key) => order.has(key))
    .sort((a, b) => order.get(a)! - order.get(b)!);
}

const EMPTY = {
  scope: null,
  meta: {},
  keys: [],
  tracks: {},
  anchor: null,
} satisfies Partial<TrackSelectionState>;

export const useTrackSelectionStore = create<TrackSelectionState>((set) => ({
  ...EMPTY,

  toggle: (scope, meta, ordered, track) =>
    set((state) => {
      const sameScope = state.scope === scope;
      const key = selectionKey(track);
      const next = new Set(sameScope ? state.keys : []);
      const tracks = sameScope ? { ...state.tracks } : {};
      if (next.has(key)) {
        next.delete(key);
        delete tracks[key];
      } else {
        next.add(key);
        tracks[key] = track;
      }
      const keys = sortKeys(next, ordering(ordered));
      if (keys.length === 0) return { ...EMPTY };
      return { scope, meta, keys, tracks, anchor: key };
    }),

  selectRange: (scope, meta, ordered, track) =>
    set((state) => {
      const order = ordering(ordered);
      const key = selectionKey(track);
      if (!order.has(key)) return state;
      const sameScope = state.scope === scope;
      const anchor =
        sameScope && state.anchor && order.has(state.anchor)
          ? state.anchor
          : key;
      const from = Math.min(order.get(anchor)!, order.get(key)!);
      const to = Math.max(order.get(anchor)!, order.get(key)!);
      const next = new Set(sameScope ? state.keys : []);
      const tracks = sameScope ? { ...state.tracks } : {};
      for (let i = from; i <= to; i++) {
        const row = ordered[i];
        const rowKey = selectionKey(row);
        next.add(rowKey);
        tracks[rowKey] = row;
      }
      return { scope, meta, keys: sortKeys(next, order), tracks, anchor };
    }),

  selectAll: (scope, meta, ordered) =>
    set(() => {
      if (ordered.length === 0) return { ...EMPTY };
      const tracks: Record<string, SelectableTrack> = {};
      for (const row of ordered) tracks[selectionKey(row)] = row;
      return {
        scope,
        meta,
        keys: ordered.map(selectionKey),
        tracks,
        anchor: selectionKey(ordered[0]),
      };
    }),

  clear: () => set({ ...EMPTY }),
}));

export function selectedTracks(
  state: Pick<TrackSelectionState, "keys" | "tracks">,
): SelectableTrack[] {
  return state.keys.map((key) => state.tracks[key]).filter(Boolean);
}
