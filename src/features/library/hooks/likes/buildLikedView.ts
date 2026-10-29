import type { Track } from "@/shared/types";
import {
  getOverrideLiked,
  hasOverrides,
  overrideEntries,
} from "./optimisticLikes";

export type LikedData = { tracks: Track[]; total: number };

export function buildLikedView(
  cache: LikedData,
  isLoading: boolean,
): { data: LikedData; isLoading: boolean } {
  if (!hasOverrides()) return { data: cache, isLoading };

  let tracks = cache.tracks.filter((t) => getOverrideLiked(t.id) !== false);
  for (const [id, liked] of overrideEntries()) {
    if (liked && !tracks.some((t) => t.id === id)) {
      tracks = [
        {
          id,
          title: "",
          artists: "",
          artistId: undefined,
          coverUrl: "",
          durationMs: 0,
          playCount: 0,
        } as Track,
        ...tracks,
      ];
    }
  }
  return { data: { tracks, total: tracks.length }, isLoading };
}
