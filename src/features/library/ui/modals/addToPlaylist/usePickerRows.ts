import { useMemo } from "react";
import { cachedPlaylistOverlap, usePlaylistsList } from "../../../hooks";
import { useRecentPlaylists } from "../../../hooks/useRecentPlaylists";
import { sortByRecent } from "../../../services/recentPlaylists";
import type { PlaylistOption, TrackDetail } from "../../../store/modalStore";

export const SEARCH_THRESHOLD = 5;

export interface PickerPlaylist {
  id: string;
  title: string;
  description?: string;
  coverUrl: string;
  trackCount: number;
}

export interface PickerRows {
  all: PickerPlaylist[];
  recentRows: PickerPlaylist[];
  otherRows: PickerPlaylist[];
  overlap: Map<string, number | undefined>;
  searchable: boolean;
}

function matches(playlist: PickerPlaylist, query: string): boolean {
  return (
    playlist.title.toLowerCase().includes(query) ||
    Boolean(playlist.description?.toLowerCase().includes(query))
  );
}

export function usePickerRows(
  open: boolean,
  tracks: TrackDetail[],
  searchQuery: string,
): PickerRows {
  const { data } = usePlaylistsList();
  const recent = useRecentPlaylists();
  const fallback: PlaylistOption[] | undefined = tracks[0]?.playlists;

  const all = useMemo<PickerPlaylist[]>(
    () =>
      sortByRecent(
        data?.playlists?.length ? data.playlists : (fallback ?? []),
        recent,
      ),
    [data?.playlists, fallback, recent],
  );

  const trackIds = useMemo(() => tracks.map((track) => track.id), [tracks]);
  const overlap = useMemo(() => {
    const map = new Map<string, number | undefined>();
    if (!open) return map;
    for (const playlist of all) {
      map.set(playlist.id, cachedPlaylistOverlap(playlist.id, trackIds));
    }
    return map;
  }, [open, all, trackIds]);

  return useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const visible = query ? all.filter((p) => matches(p, query)) : all;
    const recentSet = new Set(recent);
    const searchable = all.length >= SEARCH_THRESHOLD;
    const showSections =
      !query &&
      searchable &&
      visible.some((p) => recentSet.has(p.id)) &&
      visible.some((p) => !recentSet.has(p.id));
    return {
      all,
      recentRows: showSections
        ? visible.filter((p) => recentSet.has(p.id))
        : [],
      otherRows: showSections
        ? visible.filter((p) => !recentSet.has(p.id))
        : visible,
      overlap,
      searchable,
    };
  }, [all, recent, searchQuery, overlap]);
}
