import { useEffect, useState } from "react";
import { api, mediaUrl, toMaxQualityAvatarUrl, toClientTrack } from "@/shared/api";
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

export function useArtist(id: string | null) {
  const [data, setData] = useState<ArtistPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(id));

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    const artistId = id;
    let active = true;

    setData(null);
    setLoading(true);

    async function loadArtist() {
      try {
        const artist = await api.getArtist(artistId);
        if (!active) return;
        const tracks = artist.tracks.map(toClientTrack);
        const formatted: ArtistPageData = {
          title: artist.name,
          monthlyListeners: artist.monthlyListeners,
          verified: Boolean(artist.verified),
          description: artist.bio?.trim() || "",
          coverUrl: artist.cover ? toMaxQualityAvatarUrl(mediaUrl(artist.cover.url)) : "",
          geniusImageUrl: artist.geniusImageUrl ? mediaUrl(artist.geniusImageUrl) : undefined,
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
            explicit: album.explicit,
          })),
          reposts: [],
          singles: artist.singles.map((single) => ({
            id: single.id,
            title: single.title,
            coverUrl: single.cover ? mediaUrl(single.cover.url) : "",
            releaseType: single.releaseType,
            ...(single.year ? { releaseDate: String(single.year) } : {}),
            explicit: single.explicit,
          })),
        };

        setData(formatted);
      } catch {
        if (active) {
          setData(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadArtist();

    return () => {
      active = false;
    };
  }, [id]);

  return { data, loading };
}
