import type {
  ApiTrack,
  ArtistAlbum,
  ArtistRelease,
  Cover,
  SourcedSearchResult,
} from "@/shared/contracts";
import { asArray, asRecord, type JsonRecord, numberValue, trimmedString } from "@/shared/utils/json";
import { soundCloudPlaylistId, soundCloudTrackId, soundCloudUserId } from "./soundcloudIds";
import { safeSoundCloudExternalUrl } from "./soundcloudExternalUrl";

const ARTWORK_SIZE = 500;
const ARTWORK_VARIANT = /-(?:large|t\d+x\d+|crop|original)(?=\.[a-z]+$)/i;

export interface SoundCloudArtistRef {
  id: string;
  name: string;
}

export function soundCloudCover(rawUrl: unknown): Cover | undefined {
  const url = trimmedString(rawUrl);
  if (!url) return undefined;
  return {
    url: url.replace(ARTWORK_VARIANT, `-t${ARTWORK_SIZE}x${ARTWORK_SIZE}`),
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    fallbackUrl: url,
  };
}

export function mapSoundCloudArtist(rawUser: unknown): SoundCloudArtistRef | undefined {
  const user = asRecord(rawUser);
  const id = numberValue(user?.id);
  const name = trimmedString(user?.username);
  return id !== undefined && name ? { id: soundCloudUserId(id), name } : undefined;
}

export function mapSoundCloudCatalogTrack(rawTrack: unknown): ApiTrack | null {
  const track = asRecord(rawTrack);
  const id = numberValue(track?.id);
  const title = trimmedString(track?.title);
  if (!track || id === undefined || !title) return null;
  const artist = mapSoundCloudArtist(track.user);
  const publisher = asRecord(track.publisher_metadata);
  const cover = soundCloudCover(track.artwork_url) ?? soundCloudCover(asRecord(track.user)?.avatar_url);
  return {
    id: soundCloudTrackId(id),
    title,
    artists: artist ? [artist] : [],
    durationMs: numberValue(track.duration) ?? 0,
    ...(cover ? { cover } : {}),
    ...(publisher?.explicit === true ? { explicit: true } : {}),
  };
}

function soundCloudExternalUrl(record: JsonRecord): string | undefined {
  return safeSoundCloudExternalUrl(record.permalink_url);
}

export function mapSoundCloudSearchTrack(rawTrack: unknown): SourcedSearchResult | null {
  const record = asRecord(rawTrack);
  const track = mapSoundCloudCatalogTrack(record);
  if (!record || !track) return null;
  const externalUrl = soundCloudExternalUrl(record);
  return {
    ...track,
    type: "track",
    source: "soundcloud",
    ...(externalUrl ? { externalUrl } : {}),
  };
}

export function mapSoundCloudSearchArtist(rawUser: unknown): SourcedSearchResult | null {
  const record = asRecord(rawUser);
  const artist = mapSoundCloudArtist(record);
  if (!record || !artist) return null;
  const cover = soundCloudCover(record.avatar_url);
  const externalUrl = soundCloudExternalUrl(record);
  return {
    type: "artist",
    ...artist,
    source: "soundcloud",
    ...(cover ? { cover } : {}),
    ...(externalUrl ? { externalUrl } : {}),
  };
}

export function mapSoundCloudTracks(rawTracks: unknown): ApiTrack[] {
  return asArray(rawTracks).flatMap((raw) => mapSoundCloudCatalogTrack(raw) ?? []);
}

export function soundCloudYear(record: JsonRecord): number | undefined {
  const date = trimmedString(record.release_date) ?? trimmedString(record.display_date) ?? trimmedString(record.created_at);
  const year = date ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) && year > 1900 ? year : undefined;
}

export function soundCloudPlaylistCover(record: JsonRecord): Cover | undefined {
  const firstTrack = asRecord(asArray(record.tracks)[0]);
  return (
    soundCloudCover(record.artwork_url) ??
    soundCloudCover(firstTrack?.artwork_url) ??
    soundCloudCover(asRecord(record.user)?.avatar_url)
  );
}

export function mapSoundCloudSearchSet(rawPlaylist: unknown): SourcedSearchResult | null {
  const record = asRecord(rawPlaylist);
  const id = numberValue(record?.id);
  const title = trimmedString(record?.title);
  if (!record || id === undefined || !title) return null;
  const cover = soundCloudPlaylistCover(record);
  const artist = mapSoundCloudArtist(record.user);
  const externalUrl = soundCloudExternalUrl(record);
  const metadata = {
    id: soundCloudPlaylistId(id),
    title,
    source: "soundcloud" as const,
    ...(cover ? { cover } : {}),
    ...(externalUrl ? { externalUrl } : {}),
  };
  if (record.is_album === true || trimmedString(record.set_type)) {
    const year = soundCloudYear(record);
    return {
      type: "album",
      ...metadata,
      artists: artist ? [artist] : [],
      ...(year ? { year } : {}),
    };
  }
  return {
    type: "playlist",
    ...metadata,
    ...(artist ? { author: artist.name } : {}),
  };
}

export function mapSoundCloudRelease(rawPlaylist: unknown): ArtistAlbum | null {
  const record = asRecord(rawPlaylist);
  const id = numberValue(record?.id);
  const title = trimmedString(record?.title);
  if (!record || id === undefined || !title) return null;
  const cover = soundCloudPlaylistCover(record);
  const year = soundCloudYear(record);
  const trackCount = numberValue(record.track_count);
  return {
    id: soundCloudPlaylistId(id),
    title,
    ...(year ? { year } : {}),
    ...(cover ? { cover } : {}),
    ...(trackCount !== undefined ? { trackCount, totalTracks: trackCount } : {}),
  };
}

export function soundCloudReleaseType(rawPlaylist: unknown): ArtistRelease["releaseType"] | "album" {
  const setType = trimmedString(asRecord(rawPlaylist)?.set_type)?.toLowerCase();
  if (setType === "single") return "single";
  if (setType === "ep") return "ep";
  return "album";
}
