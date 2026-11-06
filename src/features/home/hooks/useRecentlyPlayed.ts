import { api, toClientTrack } from "@/shared/api";
import type { PopularItem } from "./usePopularTracks";
import { loadWithRetry, useSessionOwner } from "./sessionAwareLoad";
import { freshFor, useCachedResource } from "@/shared/cache/useCachedResource";

export const recentlyPlayedKeys = {
  all: ["recently_played"] as const,
};

const EMPTY_ITEMS: PopularItem[] = [];
const RECENT_POLICY = { isFresh: freshFor(60_000), revalidateOnFocus: true };

async function loadRecentlyPlayed(limit: number): Promise<PopularItem[]> {
  const fetchLimit = Math.min(100, Math.max(limit * 3, 60));
  const res = await loadWithRetry(
    () => api.getHistory(undefined, fetchLimit),
    () => true,
  );
  const seen = new Set<string>();
  const items: PopularItem[] = [];
  for (const entry of res.items) {
    const isAlbum = entry.context?.type === "album";
    const albumId = isAlbum
      ? entry.context?.id || entry.track.album?.id
      : undefined;

    if (albumId) {
      const albumKey = `album:${albumId}`;
      if (seen.has(albumKey)) continue;
      seen.add(albumKey);
      seen.add(`track:${entry.track.id}`);

      const clientTrack = toClientTrack(entry.track);
      items.push({
        type: "album",
        item: {
          id: albumId,
          title: entry.track.album?.title || clientTrack.title,
          artist: clientTrack.artists,
          coverUrl: clientTrack.coverUrl,
          totalTracks: 0,
          albumType: "album",
        },
        playCount: 1,
      });
    } else {
      const trackKey = `track:${entry.track.id}`;
      if (seen.has(trackKey)) continue;
      seen.add(trackKey);

      items.push({
        type: "track",
        item: toClientTrack(entry.track),
        playCount: 1,
      });
    }

    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

export function useRecentlyPlayed(limit = 20) {
  const owner = useSessionOwner();
  const { data, isLoading } = useCachedResource(
    `home:recent:${owner}:${limit}`,
    () => loadRecentlyPlayed(limit),
    RECENT_POLICY,
  );
  return { data: data ?? EMPTY_ITEMS, isLoading };
}
