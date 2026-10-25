import type { ImportedTrack } from "@/shared/contracts";
import { collectByKey } from "@/shared/utils/json";
import { mapInnertubeTrack } from "../innertube/innertubeTrackMapper";
import { youtubeThumbnailUrl } from "./youtubeUrl";

export interface YoutubePlaylistTrack extends ImportedTrack {
  artistIds?: (string | undefined)[];
  albumId?: string;
}

function mapRendererTrack(
  rawRenderer: unknown,
  seenIds: Set<string>,
): YoutubePlaylistTrack | undefined {
  const mapped = mapInnertubeTrack({
    musicResponsiveListItemRenderer: rawRenderer,
  });
  if (!mapped || seenIds.has(mapped.id)) return undefined;
  seenIds.add(mapped.id);
  return {
    sourceId: mapped.id,
    title: mapped.title,
    artists: mapped.artists.map((artist) => artist.name),
    artistIds: mapped.artists.map((artist) =>
      artist.id !== "unknown" ? artist.id : undefined,
    ),
    album: mapped.album?.title,
    albumId: mapped.album?.id,
    durationMs: mapped.durationMs,
    coverUrl: mapped.cover?.url ?? youtubeThumbnailUrl(mapped.id),
  };
}

export function parseInnertubeTracks(
  body: unknown,
  seenIds: Set<string>,
  tracks: YoutubePlaylistTrack[],
): void {
  for (const rawRenderer of collectByKey(
    body,
    "musicResponsiveListItemRenderer",
  )) {
    const track = mapRendererTrack(rawRenderer, seenIds);
    if (track) tracks.push(track);
  }
}
