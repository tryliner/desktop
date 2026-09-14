import { useEffect, useState } from "react";
import { api, mediaUrl, toClientTrack } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";
import type { Track } from "@/shared/types";

export interface CollectionPageData {
  type?: "playlist" | "album";
  title: string;
  author?: string;
  artists?: { id: string; name: string }[];
  description?: string;
  year?: number;
  coverUrl: string;
  tracks: Track[];
}

export function useCollection(type: string | null, id: string | null) {
  const cacheKey = type && id ? `collection:${type}:${id}` : null;
  const cached = cacheKey ? queryCache.get<CollectionPageData>(cacheKey) : undefined;
  const [data, setData] = useState<CollectionPageData | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(!cached && Boolean(type && id));

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

    const unsubscribe = queryCache.subscribe<CollectionPageData>(cacheKey, (updated) => {
      if (active) {
        setData(updated);
        setLoading(false);
      }
    });

    void queryCache
      .fetchWithSwr(
        cacheKey,
        async () => {
          const decodedId = id ? decodeURIComponent(id) : "";
          const collection =
            type === "playlist"
              ? await api.getPlaylist(id)
              : await api.getAlbum(id);

          if ((collection as any).playlist && Array.isArray((collection as any).items)) {
            const userPlaylist = (collection as any).playlist;
            const userItems = (collection as any).items as any[];
            const covers = userItems
              .map((i) => (i.track?.cover ? mediaUrl(i.track.cover.url) : ""))
              .filter(Boolean)
              .filter((url, idx, arr) => arr.indexOf(url) === idx)
              .slice(0, 4);
            const tracks: Track[] = userItems.map((item) => toClientTrack(item.track));
            const ownerName = userPlaylist.owner?.displayName || userPlaylist.owner?.username || "";
            const formatted: CollectionPageData = {
              type: "playlist",
              title: userPlaylist.title,
              author: ownerName || undefined,
              description: userPlaylist.description || undefined,
              coverUrl: covers[0] || "",
              tracks,
            };
            return formatted;
          }

          const collectionCoverUrl = collection.cover ? mediaUrl(collection.cover.url) : "";
          const tracks = (collection.tracks || []).map((t) => {
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
              if (collectionCoverUrl && (!updated.coverUrl || updated.coverUrl.includes("i.ytimg.com"))) {
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
            description: (collection as any).description,
            year: collection.year,
            coverUrl: collectionCoverUrl,
            tracks,
          };
          return formatted;
        },
        { staleTimeMs: 5 * 60 * 1000 },
      )
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
