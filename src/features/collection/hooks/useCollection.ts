import { useEffect, useState } from "react";
import { api, mediaUrl, toClientTrack } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";
import { isUserPlaylistId } from "@/shared/contracts";
import type { Track } from "@/shared/types";
import { YOUTUBE_THUMBNAIL_HOST } from "@/shared/youtube";
import { getDailyMixArtists } from "@/features/home/hooks/useDailyMixes";

export interface CollectionPageData {
  type?: "playlist" | "album";
  title: string;
  author?: string;
  artists?: { id: string; name: string }[];
  description?: string;
  year?: number;
  coverUrl: string;
  tracks: Track[];
  isDailyMix?: boolean;
}

const COLLECTION_STALE_MS = 5 * 60 * 1000;

async function loadCollection(
  type: string,
  id: string,
): Promise<CollectionPageData> {
  const decodedId = id ? decodeURIComponent(id) : "";

  if (type === "playlist" && id.startsWith("daily-mix-")) {
    const mixesRes = await api.getDailyMixes();
    const found = mixesRes.items.find((m) => m.id === id);
    if (found) {
      const clientTracks = found.tracks.map((t) => toClientTrack(t));
      const primaryCover = found.cover?.url
        ? mediaUrl(found.cover.url)
        : clientTracks[0]?.coverUrl || clientTracks[1]?.coverUrl || "";
      const computedArtists = getDailyMixArtists(
        found.clusterArtists,
        clientTracks,
        4,
      );
      const formatted: CollectionPageData = {
        type: "playlist",
        title: found.title,
        author:
          computedArtists.length > 0 ? computedArtists.join(", ") : "Daily Mix",
        description: found.description,
        coverUrl: primaryCover,
        tracks: clientTracks,
        isDailyMix: true,
      };
      return formatted;
    }
  }

  if (type === "playlist" && isUserPlaylistId(decodedId)) {
    const shared = await api.getSharedPlaylist(decodedId);
    const cover = shared.items.find((item) => item.track.cover)?.track.cover;
    const ownerName = shared.owner?.displayName || shared.owner?.username || "";
    const formatted: CollectionPageData = {
      type: "playlist",
      title: shared.title,
      author: ownerName || undefined,
      description: shared.description || undefined,
      coverUrl: cover ? mediaUrl(cover.url) : "",
      tracks: shared.items.map((item) => toClientTrack(item.track)),
    };
    return formatted;
  }

  const collection =
    type === "playlist" ? await api.getPlaylist(id) : await api.getAlbum(id);

  const collectionCoverUrl = collection.cover
    ? mediaUrl(collection.cover.url)
    : "";
  const tracks = collection.tracks.map((t) => {
    const clientTrack = toClientTrack(t);
    let updated = clientTrack;
    if (collection.type === "album") {
      const albumData = {
        id: decodedId,
        title: collection.title,
      };
      updated = {
        ...updated,
        album: updated.album?.id ? updated.album : albumData,
      };
      if (
        collectionCoverUrl &&
        (!updated.coverUrl || updated.coverUrl.includes(YOUTUBE_THUMBNAIL_HOST))
      ) {
        updated = { ...updated, coverUrl: collectionCoverUrl };
      }
    }
    return updated;
  });

  const formatted: CollectionPageData = {
    type: collection.type,
    title: collection.title,
    author: collection.type === "playlist" ? collection.author : undefined,
    artists: collection.type === "album" ? collection.artists : undefined,
    description:
      collection.type === "playlist" ? collection.description : undefined,
    year: collection.year,
    coverUrl: collectionCoverUrl,
    tracks,
  };
  return formatted;
}

export function prefetchCollection(type: string, id: string): void {
  const cacheKey = `collection:${type}:${id}`;
  if (queryCache.get(cacheKey)) return;
  void queryCache
    .fetchWithSwr(cacheKey, () => loadCollection(type, id), {
      staleTimeMs: COLLECTION_STALE_MS,
    })
    .catch(() => undefined);
}

export function useCollection(type: string | null, id: string | null) {
  const cacheKey = type && id ? `collection:${type}:${id}` : null;
  const cached = cacheKey
    ? queryCache.get<CollectionPageData>(cacheKey)
    : undefined;
  const [data, setData] = useState<CollectionPageData | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(
    !cached && Boolean(type && id),
  );

  useEffect(() => {
    if (!type || !id || !cacheKey) {
      setData(null);
      setLoading(false);
      return;
    }

    const initial = queryCache.get<CollectionPageData>(cacheKey);
    if (initial) {
      setData(initial);
      setLoading(false);
    } else {
      setData(null);
      setLoading(true);
    }

    let active = true;

    const unsubscribe = queryCache.subscribe<CollectionPageData>(
      cacheKey,
      (updated) => {
        if (active) {
          setData(updated);
          setLoading(false);
        }
      },
    );

    void queryCache
      .fetchWithSwr(cacheKey, () => loadCollection(type, id), {
        staleTimeMs: COLLECTION_STALE_MS,
      })
      .then(({ data: result }) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && !queryCache.get(cacheKey)) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [type, id, cacheKey]);

  return { data, loading };
}
