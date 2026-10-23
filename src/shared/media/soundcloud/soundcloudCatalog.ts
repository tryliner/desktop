import type {
  AlbumDetails,
  ApiTrack,
  ArtistDetails,
  CatalogPlaylistDetails,
  RadioResponse,
  TrackDetails,
} from "@/shared/contracts";
import { asArray, isRecord, numberValue, trimmedString } from "@/shared/utils/json";
import { getCollection, getJson, requireId, SoundCloudCatalogError } from "./soundcloudCatalogRequest";
import { parseSoundCloudPlaylistId, parseSoundCloudUserId, soundCloudPlaylistId } from "./soundcloudIds";
import {
  mapSoundCloudArtist,
  mapSoundCloudCatalogTrack,
  mapSoundCloudRelease,
  mapSoundCloudTracks,
  soundCloudCover,
  soundCloudPlaylistCover,
  soundCloudReleaseType,
  soundCloudYear,
} from "./soundcloudMappers";
import { hydrateSoundCloudStubs } from "./soundcloudStubs";
import { toSoundCloudTrackId } from "./soundcloudTrack";
import { searchSoundCloud } from "./soundcloudSearch";

const ARTIST_TRACK_LIMIT = "50";
const ARTIST_TOP_LIMIT = "10";
const DEFAULT_RADIO_SIZE = 25;

function uniqueTracks(tracks: ApiTrack[]): ApiTrack[] {
  const seen = new Set<string>();
  return tracks.filter((track) => !seen.has(track.id) && Boolean(seen.add(track.id)));
}

function splitReleases(releases: unknown[]): Pick<ArtistDetails, "albums" | "singles"> {
  const split: Pick<ArtistDetails, "albums" | "singles"> = { albums: [], singles: [] };
  for (const raw of releases) {
    const release = mapSoundCloudRelease(raw);
    const releaseType = soundCloudReleaseType(raw);
    if (!release) continue;
    if (releaseType === "album") split.albums.push(release);
    else split.singles.push({ ...release, releaseType });
  }
  return split;
}

async function getArtist(artistId: string, signal?: AbortSignal): Promise<ArtistDetails> {
  const userId = requireId(parseSoundCloudUserId(artistId), "Artist");
  const [user, topTracks, uploads, releases] = await Promise.all([
    getJson(`/users/${userId}`, {}, signal),
    getCollection(`/users/${userId}/toptracks`, ARTIST_TOP_LIMIT, signal),
    getCollection(`/users/${userId}/tracks`, ARTIST_TRACK_LIMIT, signal),
    getCollection(`/users/${userId}/albums`, ARTIST_TRACK_LIMIT, signal),
  ]);
  const artist = mapSoundCloudArtist(user);
  if (!artist) throw new SoundCloudCatalogError("Artist was not found.", 404);
  const cover = soundCloudCover(user.avatar_url);
  const bio = trimmedString(user.description);
  const { albums, singles } = splitReleases(releases);
  return {
    type: "artist",
    id: artist.id,
    name: trimmedString(user.full_name) ?? artist.name,
    ...(bio ? { bio } : {}),
    ...(cover ? { cover } : {}),
    verified: user.verified === true,
    tracks: uniqueTracks([...mapSoundCloudTracks(topTracks), ...mapSoundCloudTracks(uploads)]),
    albums,
    singles,
  };
}

async function getArtistImage(artistId: string, signal?: AbortSignal): Promise<string | undefined> {
  const userId = parseSoundCloudUserId(artistId);
  if (!userId) return undefined;
  return soundCloudCover((await getJson(`/users/${userId}`, {}, signal)).avatar_url)?.url;
}

async function loadSet(setId: string, signal?: AbortSignal) {
  const playlistId = requireId(parseSoundCloudPlaylistId(setId), "Playlist");
  const record = await getJson(`/playlists/${playlistId}`, { representation: "full" }, signal);
  const rawTracks = await hydrateSoundCloudStubs(asArray(record.tracks).filter(isRecord), signal);
  const tracks = mapSoundCloudTracks(rawTracks);
  const title = trimmedString(record.title);
  if (!title) throw new SoundCloudCatalogError("Playlist was not found.", 404);
  const cover = soundCloudPlaylistCover({ ...record, tracks: rawTracks });
  const year = soundCloudYear(record);
  const summary = {
    id: soundCloudPlaylistId(playlistId),
    title,
    ...(year ? { year } : {}),
    ...(cover ? { cover } : {}),
    trackCount: numberValue(record.track_count) ?? tracks.length,
    durationMs: tracks.reduce((total, track) => total + track.durationMs, 0),
    tracks,
  };
  return { record, summary };
}

async function getAlbum(albumId: string, signal?: AbortSignal): Promise<AlbumDetails> {
  const { record, summary } = await loadSet(albumId, signal);
  const artist = mapSoundCloudArtist(record.user);
  return { type: "album", ...summary, artists: artist ? [artist] : [] };
}

async function getPlaylist(playlistId: string, signal?: AbortSignal): Promise<CatalogPlaylistDetails> {
  const { record, summary } = await loadSet(playlistId, signal);
  const author = mapSoundCloudArtist(record.user)?.name;
  const description = trimmedString(record.description);
  return { type: "playlist", ...summary, ...(author ? { author } : {}), ...(description ? { description } : {}) };
}

async function getTrack(trackId: string, signal?: AbortSignal): Promise<TrackDetails> {
  const numericId = requireId(toSoundCloudTrackId(trackId), "Track");
  const record = await getJson(`/tracks/${numericId}`, {}, signal);
  const track = mapSoundCloudCatalogTrack(record);
  if (!track) throw new SoundCloudCatalogError("Track was not found.", 404);
  const description = trimmedString(record.description);
  const releaseDate = trimmedString(record.release_date) ?? trimmedString(record.display_date);
  return { ...track, ...(description ? { description } : {}), ...(releaseDate ? { releaseDate } : {}) };
}

async function getRadio(trackId: string, k = DEFAULT_RADIO_SIZE, signal?: AbortSignal): Promise<RadioResponse> {
  const numericId = requireId(toSoundCloudTrackId(trackId), "Track");
  const related = await getCollection(`/tracks/${numericId}/related`, String(k), signal);
  return { items: mapSoundCloudTracks(related).slice(0, k) };
}

export const soundcloudCatalog = {
  search: searchSoundCloud,
  getArtist,
  getArtistImage,
  getAlbum,
  getPlaylist,
  getTrack,
  getRadio,
};
