import { mediaUrl } from "./api";

import type { Track as ContractTrack } from "../contracts";
import type { Track } from "../types";

// the view model the ui renders from an api / catalog Track: artists as one
// string plus the list, the cover url, 0 for an unknown duration
export function toClientTrack(source: ContractTrack | null | undefined): Track {
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

  const artistList = source.artists.map((artist) => ({
    id: artist.id ?? "",
    name: artist.name,
  }));

  return {
    id: source.id,
    title: source.title,
    artists: artistList
      .map((artist) => artist.name)
      .filter(Boolean)
      .join(", "),
    artistList: artistList.length > 0 ? artistList : undefined,
    artistId: artistList.find((artist) => artist.id)?.id,
    coverUrl: source.cover ? mediaUrl(source.cover.url) : "",
    durationMs: source.durationMs ?? 0,
    playCount: 0,
    explicit: source.explicit,
    ...(source.audioVariant ? { audioVariant: source.audioVariant } : {}),
    album: source.album,
  };
}
