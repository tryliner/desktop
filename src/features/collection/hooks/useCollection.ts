import { useEffect, useState } from "react";
import { api, getAuthSession, mediaUrl, toClientTrack } from "@/shared/api";
import { queryCache } from "@/shared/cache/queryCache";
import type { Track } from "@/shared/types";
import { getDailyMixArtists } from "@/features/home/hooks/useDailyMixes";
import { generateYtDailyMixes } from "@/features/home/services/ytDailyMixesService";

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

export function useCollection(type: string | null, id: string | null) {
  const [currentAccount, setCurrentAccount] = useState(
    () => getAuthSession()?.user?.id || "guest"
  );
  const accountId = currentAccount;
  const decodedId = id ? decodeURIComponent(id) : "";
  const isDailyMix = Boolean(
    id &&
      (decodedId.startsWith("daily-mix") ||
        decodedId.startsWith("mix-") ||
        id.startsWith("daily-mix") ||
        id.startsWith("mix-"))
  );
  const cacheKey =
    type && id
      ? isDailyMix
        ? `collection:playlist:${accountId}:${decodedId || id}`
        : `collection:${type}:${id}`
      : null;
  const cached = cacheKey ? queryCache.get<CollectionPageData>(cacheKey) : undefined;
  const [data, setData] = useState<CollectionPageData | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(!cached && Boolean(type && id));

  useEffect(() => {
    const onAuthChanged = () => {
      const nextAccount = getAuthSession()?.user?.id || "guest";
      if (nextAccount !== currentAccount) {
        setCurrentAccount(nextAccount);
        queryCache.clear();
        if (isDailyMix) {
          setData(null);
          setLoading(true);
        }
      }
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => {
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, [currentAccount, isDailyMix]);

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
          const isDailyMix =
            decodedId.startsWith("daily-mix") ||
            decodedId.startsWith("mix-") ||
            id.startsWith("daily-mix") ||
            id.startsWith("mix-");

          if (type === "playlist" && isDailyMix) {
            const cached =
              queryCache.get<CollectionPageData>(`collection:playlist:${accountId}:${decodedId}`) ||
              queryCache.get<CollectionPageData>(`collection:playlist:${accountId}:${id}`) ||
              queryCache.get<CollectionPageData>(cacheKey) ||
              queryCache.get<CollectionPageData>(`collection:playlist:${decodedId}`) ||
              queryCache.get<CollectionPageData>(`collection:playlist:${id}`);
            if (cached) return cached;
            const mixesRes = await api.getDailyMixes().catch(() => ({ items: [] }));
            const found = mixesRes.items?.find((m) => m.id === id || m.id === decodedId);
            if (found) {
              const clientTracks = (found.tracks || []).map((t) => toClientTrack(t));
              const primaryCover = found.cover?.url
                ? mediaUrl(found.cover.url)
                : (clientTracks[0]?.coverUrl || clientTracks[1]?.coverUrl || "");
              const computedArtists = getDailyMixArtists(found.clusterArtists, clientTracks, 4);
              const formatted: CollectionPageData = {
                type: "playlist",
                title: found.title,
                author: computedArtists.length > 0 ? computedArtists.join(", ") : "Daily Mix",
                description: found.description,
                coverUrl: primaryCover,
                tracks: clientTracks,
                isDailyMix: true,
              };
              return formatted;
            }

            const generatedMixes = await generateYtDailyMixes().catch(() => []);
            const foundGenerated = generatedMixes.find((m) => m.id === id || m.id === decodedId);
            if (foundGenerated) {
              const formatted: CollectionPageData = {
                type: "playlist",
                title: foundGenerated.title,
                author:
                  foundGenerated.clusterArtists.length > 0
                    ? foundGenerated.clusterArtists.join(", ")
                    : "Daily Mix",
                description: foundGenerated.description,
                coverUrl: foundGenerated.coverUrl || "",
                tracks: foundGenerated.tracks,
                isDailyMix: true,
              };
              queryCache.set(`collection:playlist:${accountId}:${foundGenerated.id}`, formatted);
              queryCache.set(`collection:playlist:${accountId}:${encodeURIComponent(foundGenerated.id)}`, formatted);
              queryCache.set(`collection:playlist:${foundGenerated.id}`, formatted);
              queryCache.set(`collection:playlist:${encodeURIComponent(foundGenerated.id)}`, formatted);
              return formatted;
            }
          }

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
          const tracks = (collection.tracks || []).map((t: any) => {
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
