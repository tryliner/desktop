import { mediaUrl } from "./api";
import type { ApiTrack } from "../contracts";
import type { Track } from "../types";

export function toClientTrack(source: any): Track {
  if (!source) {
    return {
      id: "",
      title: "",
      artists: "",
      coverUrl: "",
      durationMs: 0,
      playCount: 0,
    };
  }

  let artistsList: { id?: string; name: string }[] = [];

  if (Array.isArray(source.artistList) && source.artistList.length > 0) {
    artistsList = source.artistList.map((artist: any) => ({
      id: typeof artist === "string" ? "" : (artist?.id ?? ""),
      name: typeof artist === "string" ? artist : (artist?.name ?? ""),
    }));
  } else if (Array.isArray(source.artists) && source.artists.length > 0) {
    artistsList = source.artists.map((artist: any) => ({
      id: typeof artist === "string" ? "" : (artist?.id ?? ""),
      name: typeof artist === "string" ? artist : (artist?.name ?? ""),
    }));
  } else if (typeof source.artist === "object" && source.artist !== null) {
    artistsList = [
      {
        id: source.artist.id ?? "",
        name: source.artist.name ?? "",
      },
    ];
  } else if (typeof source.artists === "string" && source.artists.trim()) {
    const rawArtistId = source.artistId || source.artist_id || "";
    const parts = source.artists.split(",").map((p: string) => p.trim()).filter(Boolean);
    artistsList = parts.map((name: string, idx: number) => ({
      id: idx === 0 ? rawArtistId : "",
      name,
    }));
  } else if (typeof source.artist === "string" && source.artist.trim()) {
    artistsList = [
      {
        id: source.artistId || source.artist_id || "",
        name: source.artist.trim(),
      },
    ];
  }

  const artistsString =
    typeof source.artists === "string"
      ? source.artists
      : typeof source.artist === "string"
        ? source.artist
        : artistsList.map((artist) => artist.name).filter(Boolean).join(", ");

  const primaryArtistId =
    artistsList.find((artist) => Boolean(artist.id && artist.id !== "unknown"))?.id ||
    (source.artistId && source.artistId !== "unknown" ? source.artistId : undefined) ||
    (source.artist_id && source.artist_id !== "unknown" ? source.artist_id : undefined) ||
    (artistsList[0]?.id && artistsList[0].id !== "unknown" ? artistsList[0].id : undefined);

  const coverUrl = source.cover
    ? mediaUrl(source.cover.url ?? source.cover)
    : source.coverUrl ?? source.cover_url ?? "";

  const album =
    source.album && typeof source.album === "object"
      ? {
          id: source.album.id ? String(source.album.id) : "",
          title: source.album.title ? String(source.album.title) : "",
        }
      : undefined;

  return {
    id: source.id,
    title: source.title,
    artists: artistsString,
    artistList: artistsList.length > 0 ? artistsList : undefined,
    artistId: primaryArtistId,
    coverUrl,
    durationMs: source.durationMs ?? source.duration_ms ?? 0,
    playCount: source.playCount ?? 0,
    explicit: source.explicit,
    album: album && (album.id || album.title) ? album : undefined,
  };
}

