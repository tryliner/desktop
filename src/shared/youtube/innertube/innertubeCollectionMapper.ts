import type {
  AlbumDetails,
  CatalogPlaylistDetails,
  Track,
  TrackArtist,
} from "@/shared/contracts";
import { findFirst, type JsonRecord, walkRecords } from "@/shared/utils/json";
import {
  getRuns,
  getText,
  runPageType,
  runsToArtists,
  yearFromRuns,
} from "./innertubeJson";
import { coverFromThumbnail } from "./innertubeThumbnail";
import { mapInnertubeTrack } from "./innertubeTrackMapper";

export function mapInnertubeBrowseTracks(
  body: unknown,
  fallbackArtists: TrackArtist[] = [],
): Track[] {
  const tracks: Track[] = [];
  const seen = new Set<string>();
  walkRecords(body, (record) => {
    if (!record.musicResponsiveListItemRenderer) return false;
    const track = mapInnertubeTrack(record, fallbackArtists);
    if (track && !seen.has(track.id)) {
      seen.add(track.id);
      tracks.push(track);
    }
    return true;
  });
  return tracks;
}

export function trackCountFrom(value: unknown): number | undefined {
  const match = getText(value)?.match(/([\d,]+)\s+tracks?/i);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

export function microformatCover(body: unknown, isArtist = false) {
  return coverFromThumbnail(
    findFirst(body, "microformatDataRenderer")?.thumbnail,
    { isArtist },
  );
}

export function mapInnertubeAlbumDetails(
  id: string,
  body: unknown,
): AlbumDetails | null {
  const header = findFirst(body, "musicResponsiveHeaderRenderer");
  const title = getText(header?.title);
  const artists = runsToArtists(
    getRuns(header?.straplineTextOne),
    (type) => type === "MUSIC_PAGE_TYPE_ARTIST",
  );
  if (!title || artists.length === 0) return null;
  const cover = coverFromThumbnail(header?.thumbnail);
  const year = yearFromRuns(header?.subtitle);
  const trackCount = trackCountFrom(header?.secondSubtitle);
  const tracks = mapInnertubeBrowseTracks(body, artists).map((track) => ({
    ...track,
    cover: cover ?? track.cover,
    album: track.album ?? { id, title },
  }));
  return {
    type: "album",
    id,
    title,
    artists,
    ...(year ? { year } : {}),
    ...(cover ? { cover } : {}),
    ...(trackCount ? { trackCount } : {}),
    tracks,
  };
}

const NOISE_PATTERNS = [
  /^(playlist|плейлист|album|альбом|ep|single|сингл|сборник|радио)$/i,
  /^\d{4}$/,
  /^\d+\s*(tracks?|songs?|трек|треков|пісень|пісні)/i,
];

function isNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "•" || trimmed === "-" || trimmed === "—")
    return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function splitParts(value: unknown): string[] {
  return (getText(value) ?? "")
    .split("•")
    .map((part) => part.trim())
    .filter(Boolean);
}

function playlistMetadata(header: JsonRecord | undefined): {
  author?: string;
  description?: string;
} {
  if (!header) return {};
  const runs = [
    ...getRuns(header.straplineTextOne),
    ...getRuns(header.subtitle),
  ];
  const channelRun = runs.find((run) => {
    const type = runPageType(run);
    return (
      (type === "MUSIC_PAGE_TYPE_USER_CHANNEL" ||
        type === "MUSIC_PAGE_TYPE_ARTIST") &&
      typeof run.text === "string" &&
      Boolean(run.text.trim())
    );
  });
  const parts = [
    ...splitParts(header.straplineTextOne),
    ...splitParts(header.subtitle),
  ];
  const author =
    typeof channelRun?.text === "string"
      ? channelRun.text.trim()
      : parts.find((part) => !isNoise(part));
  const remaining = parts.filter((part) => part !== author && !isNoise(part));
  const description =
    getText(header.description) ??
    (remaining.length > 0 ? remaining.join(", ") : undefined);
  return {
    ...(author ? { author } : {}),
    ...(description ? { description } : {}),
  };
}

export function mapInnertubePlaylistDetails(
  id: string,
  body: unknown,
): CatalogPlaylistDetails | null {
  const header = findFirst(body, "musicResponsiveHeaderRenderer");
  const title = getText(header?.title);
  if (!title) return null;
  const cover = coverFromThumbnail(header?.thumbnail) ?? microformatCover(body);
  const year = yearFromRuns(header?.subtitle);
  const trackCount = trackCountFrom(header?.secondSubtitle);
  return {
    type: "playlist",
    id,
    title,
    ...playlistMetadata(header),
    ...(year ? { year } : {}),
    ...(cover ? { cover } : {}),
    ...(trackCount ? { trackCount } : {}),
    tracks: mapInnertubeBrowseTracks(body),
  };
}
