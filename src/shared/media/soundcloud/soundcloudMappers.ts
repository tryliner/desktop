import type {
  ApiTrack,
  ArtistAlbum,
  ArtistRelease,
  Cover,
  SearchResult,
} from "@/shared/contracts";
import {
  asArray,
  asRecord,
  type JsonRecord,
  numberValue,
  trimmedString,
} from "@/shared/utils/json";
import {
  soundCloudPlaylistId,
  soundCloudTrackId,
  soundCloudUserId,
} from "./soundcloudIds";

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

export function mapSoundCloudArtist(
  rawUser: unknown,
): SoundCloudArtistRef | undefined {
  const user = asRecord(rawUser);
  const id = numberValue(user?.id);
  const name = trimmedString(user?.username);
  return id !== undefined && name
    ? { id: soundCloudUserId(id), name }
    : undefined;
}

export function mapSoundCloudCatalogTrack(rawTrack: unknown): ApiTrack | null {
  const track = asRecord(rawTrack);
  const id = numberValue(track?.id);
  const title = trimmedString(track?.title);
  if (!track || id === undefined || !title) return null;
  const artist = mapSoundCloudArtist(track.user);
  const publisher = asRecord(track.publisher_metadata);
  const cover =
    soundCloudCover(track.artwork_url) ??
    soundCloudCover(asRecord(track.user)?.avatar_url);
  return {
    id: soundCloudTrackId(id),
    title,
    artists: artist ? [artist] : [],
    durationMs: numberValue(track.duration) ?? 0,
    ...(cover ? { cover } : {}),
    ...(publisher?.explicit === true ? { explicit: true } : {}),
  };
}

export function mapSoundCloudTracks(rawTracks: unknown): ApiTrack[] {
  return asArray(rawTracks).flatMap(
    (raw) => mapSoundCloudCatalogTrack(raw) ?? [],
  );
}

export function soundCloudYear(record: JsonRecord): number | undefined {
  const date =
    trimmedString(record.release_date) ??
    trimmedString(record.display_date) ??
    trimmedString(record.created_at);
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
    ...(trackCount !== undefined
      ? { trackCount, totalTracks: trackCount }
      : {}),
  };
}

export function soundCloudReleaseType(
  rawPlaylist: unknown,
): ArtistRelease["releaseType"] | "album" {
  const setType = trimmedString(asRecord(rawPlaylist)?.set_type)?.toLowerCase();
  if (setType === "single") return "single";
  if (setType === "ep") return "ep";
  return "album";
}

export function mapSoundCloudSearchItem(raw: unknown): SearchResult | null {
  const record = asRecord(raw);
  const kind = trimmedString(record?.kind);
  if (!record || !kind) return null;

  if (kind === "track") {
    const track = mapSoundCloudCatalogTrack(record);
    return track ? { ...track, type: "track" } : null;
  }

  if (kind === "user") {
    const artist = mapSoundCloudArtist(record);
    if (!artist) return null;
    const cover = soundCloudCover(record.avatar_url);
    return {
      type: "artist",
      id: artist.id,
      name: trimmedString(record.full_name) ?? artist.name,
      ...(cover ? { cover } : {}),
    };
  }

  if (kind === "playlist") {
    const release = mapSoundCloudRelease(record);
    if (!release) return null;
    if (record.is_album === true) {
      const artist = mapSoundCloudArtist(record.user);
      return {
        type: "album",
        ...release,
        artists: artist ? [artist] : [],
      };
    }
    const author = mapSoundCloudArtist(record.user)?.name;
    return {
      type: "playlist",
      ...release,
      ...(author ? { author } : {}),
    };
  }

  return null;
}
