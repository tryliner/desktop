import { useEffect, useState } from "react";
import { queryCache } from "@/shared/cache/queryCache";
import {
  api,
  mediaUrl,
  toMaxQualityAvatarUrl,
  toClientTrack,
} from "@/shared/api";
import type { Track } from "@/shared/types";

export interface ArtistAlbumViewModel {
  id: string;
  title: string;
  coverUrl: string;
  releaseDate?: string;
  totalTracks?: number;
  explicit?: boolean;
}

export interface ArtistReleaseViewModel extends ArtistAlbumViewModel {
  releaseType: "single" | "ep";
}

export interface ArtistPageData {
  title: string;
  description: string;
  coverUrl: string;
  geniusImageUrl?: string;
  geniusAka?: string[];
  geniusUsername?: string;
  monthlyListeners?: string;
  verified: boolean;
  followers?: number;
  totalListens?: number;
  totalTracks?: number;
  tracks: Track[];
  popularSongs: Track[];
  albums: ArtistAlbumViewModel[];
  reposts: Track[];
  singles: ArtistReleaseViewModel[];
}

async function loadArtistPage(artistId: string): Promise<ArtistPageData> {
  const artist = await api.getArtist(artistId);
  const tracks = artist.tracks.map(toClientTrack);
  const formatted: ArtistPageData = {
    title: artist.name,
    monthlyListeners: artist.monthlyListeners,
    verified: Boolean(artist.verified),
    description: artist.bio?.trim() || "",
    coverUrl: artist.cover
      ? toMaxQualityAvatarUrl(mediaUrl(artist.cover.url))
      : "",
    geniusImageUrl: artist.geniusImageUrl
      ? mediaUrl(artist.geniusImageUrl)
      : undefined,
    geniusAka: artist.geniusAka,
    geniusUsername: artist.geniusUsername,
    totalTracks: tracks.length,
    tracks,
    popularSongs: tracks.slice(0, 5),
    albums: artist.albums.map((album) => ({
      id: album.id,
      title: album.title,
      coverUrl: album.cover ? mediaUrl(album.cover.url) : "",
      ...(album.year ? { releaseDate: String(album.year) } : {}),
      totalTracks: album.totalTracks ?? album.trackCount,
      explicit: album.explicit,
    })),
    reposts: [],
    singles: artist.singles.map((single) => ({
      id: single.id,
      title: single.title,
      coverUrl: single.cover ? mediaUrl(single.cover.url) : "",
      releaseType: single.releaseType,
      ...(single.year ? { releaseDate: String(single.year) } : {}),
      totalTracks: single.totalTracks ?? single.trackCount,
      explicit: single.explicit,
    })),
  };
  return formatted;
}

const ARTIST_STALE_MS = 10 * 60 * 1000;

function artistCacheKey(id: string): string {
  return `artist:${id}`;
}

export function prefetchArtist(id: string): void {
  const key = artistCacheKey(id);
  if (queryCache.get(key)) return;
  void queryCache
    .fetchWithSwr(key, () => loadArtistPage(id), {
      staleTimeMs: ARTIST_STALE_MS,
    })
    .catch(() => undefined);
}

export function useArtist(id: string | null) {
  const cacheKey = id ? artistCacheKey(id) : null;
  const cached = cacheKey
    ? queryCache.get<ArtistPageData>(cacheKey)
    : undefined;
  const [data, setData] = useState<ArtistPageData | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(!cached && Boolean(id));

  useEffect(() => {
    if (!id || !cacheKey) {
      setData(null);
      setLoading(false);
      return;
    }
    const initial = queryCache.get<ArtistPageData>(cacheKey);
    setData(initial ?? null);
    setLoading(!initial);

    let active = true;
    const unsubscribe = queryCache.subscribe<ArtistPageData>(
      cacheKey,
      (updated) => {
        if (!active) return;
        setData(updated);
        setLoading(false);
      },
    );
    void queryCache
      .fetchWithSwr(cacheKey, () => loadArtistPage(id), {
        staleTimeMs: ARTIST_STALE_MS,
      })
      .then(({ data: result }) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        if (!active || queryCache.get(cacheKey)) return;
        setData(null);
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [id, cacheKey]);

  return { data, loading };
}
