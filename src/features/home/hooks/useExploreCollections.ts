import { api } from "@/shared/api";
import type { PopularItem } from "./usePopularTracks";
import { freshFor, useCachedResource } from "@/shared/cache/useCachedResource";

const EMPTY_ITEMS: PopularItem[] = [];
const EXPLORE_POLICY = { isFresh: freshFor(10 * 60_000) };

function useCachedItems(key: string, load: () => Promise<PopularItem[]>) {
  const { data, isLoading } = useCachedResource(
    `home:${key}`,
    load,
    EXPLORE_POLICY,
  );
  return { items: data ?? EMPTY_ITEMS, isLoading };
}

const MIN_TOP_ALBUM_TRACKS = 5;
const TOP_ALBUMS_LIMIT = 20;

async function loadPopularAlbums(): Promise<PopularItem[]> {
  const response = await api.getPopularAlbums("7d", TOP_ALBUMS_LIMIT * 2);
  const fullAlbums = response.items
    .filter((album) => album.trackCount >= MIN_TOP_ALBUM_TRACKS)
    .slice(0, TOP_ALBUMS_LIMIT);
  return fullAlbums.map((album) => ({
    type: "album",
    item: {
      id: album.id,
      title: album.title,
      artist: album.artist,
      ...(album.artists?.length ? { artistList: album.artists } : {}),
      coverUrl: album.coverUrl ?? "",
      totalTracks: album.trackCount,
      albumType: "album",
    },
    playCount: album.playCount,
  }));
}

async function loadMostSaved(): Promise<PopularItem[]> {
  const response = await api.getMostSaved("all", 20);
  return response.items.map((entry): PopularItem =>
    entry.type === "album"
      ? {
          type: "album",
          item: {
            id: entry.id,
            title: entry.title,
            artist: entry.subtitle,
            ...(entry.artists?.length ? { artistList: entry.artists } : {}),
            coverUrl: entry.coverUrl ?? "",
            totalTracks: 0,
            albumType: "album",
          },
          playCount: entry.saves,
        }
      : {
          type: "playlist",
          item: {
            id: entry.id,
            title: entry.title,
            owner: entry.subtitle,
            coverUrl: entry.coverUrl ?? "",
            totalTracks: 0,
          },
          playCount: entry.saves,
        },
  );
}

export function usePopularAlbums() {
  return useCachedItems("popular-albums", loadPopularAlbums);
}

export function useMostSaved() {
  return useCachedItems("most-saved", loadMostSaved);
}
