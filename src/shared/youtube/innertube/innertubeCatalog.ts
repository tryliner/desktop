import type {
  ArtistDetails,
  RadioResponse,
  SearchResult,
  SearchType,
  Track,
  TrackDetails,
} from "@/shared/contracts";
import { InnertubeError, postInnertube } from "./innertubeClient";
import {
  getArtistDiscographyBrowses,
  getArtistTopSongsBrowse,
  mapDiscographyAlbums,
  mapDiscographySingles,
  mapInnertubeArtistDetails,
} from "./innertubeArtistMapper";
import { mapInnertubeBrowseTracks } from "./innertubeCollectionMapper";
import {
  channelIdOfArtist,
  fetchChannelUploads,
} from "./innertubeChannelUploads";
import {
  getQueueItems,
  getTrackItem,
  mapInnertubeRadioTrack,
  mapInnertubeTrackDetails,
} from "./innertubeQueueMapper";
import { searchCatalog } from "./innertubeSearch";
import { getAlbum, getPlaylist } from "./innertubeCollections";

export interface RadioOptions {
  k?: number;
  signal?: AbortSignal;
}

const DEFAULT_RADIO_SIZE = 25;

function browse(
  browseId: string,
  params?: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return postInnertube(
    "browse",
    { browseId, ...(params ? { params } : {}) },
    { signal },
  );
}

function next(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return postInnertube("next", body, { signal });
}

function notFound(entity: string): InnertubeError {
  return new InnertubeError(`${entity} was not found.`, 404);
}

async function getTrack(
  trackId: string,
  signal?: AbortSignal,
): Promise<TrackDetails> {
  const fromNext = await next({ videoId: trackId }, signal)
    .then((body) => mapInnertubeTrackDetails(getTrackItem(body, trackId)))
    .catch(() => null);
  if (fromNext) return fromNext;

  const searched = await searchCatalog(trackId, "track", signal).catch(
    () => [],
  );
  const match = searched.find((item) => item.id === trackId);
  if (match?.type === "track") {
    const { type: _type, viewer: _viewer, ...track } = match;
    return track;
  }
  throw notFound("Track");
}

async function getRadio(
  trackId: string,
  options: RadioOptions = {},
): Promise<RadioResponse> {
  let queue = getQueueItems(
    await next(
      { videoId: trackId, playlistId: `RDAMVM${trackId}` },
      options.signal,
    ),
  );
  if (queue.length === 0) {
    queue = getQueueItems(await next({ videoId: trackId }, options.signal));
  }
  const limit = options.k ?? DEFAULT_RADIO_SIZE;
  const items: Track[] = [];
  for (const raw of queue) {
    const track = mapInnertubeRadioTrack(raw);
    if (track) items.push(track);
    if (items.length >= limit) break;
  }
  return { items };
}

// the album and single carousels show only the first releases, so every
// release comes from the discography pages; a page that fails leaves the
// carousel's releases
async function loadDiscography(
  body: unknown,
  signal?: AbortSignal,
): Promise<Partial<Pick<ArtistDetails, "albums" | "singles">>> {
  const pages = getArtistDiscographyBrowses(body);
  const [albums, singles] = await Promise.all([
    pages.albums
      ? browse(pages.albums.browseId, pages.albums.params, signal)
          .then(mapDiscographyAlbums)
          .catch(() => [])
      : [],
    pages.singles
      ? browse(pages.singles.browseId, pages.singles.params, signal)
          .then(mapDiscographySingles)
          .catch(() => [])
      : [],
  ]);
  return {
    ...(albums.length > 0 ? { albums } : {}),
    ...(singles.length > 0 ? { singles } : {}),
  };
}

async function loadArtist(
  artistId: string,
  signal?: AbortSignal,
): Promise<ArtistDetails | null> {
  const body = await browse(artistId, undefined, signal);
  const page = mapInnertubeArtistDetails(artistId, body);
  if (!page) return null;
  const artistRef = { id: page.id, name: page.name };
  const topSongs = getArtistTopSongsBrowse(body);
  const [allTracks, discography] = await Promise.all([
    topSongs
      ? browse(topSongs.browseId, topSongs.params, signal)
          .then((tracksBody) =>
            mapInnertubeBrowseTracks(tracksBody, [artistRef]),
          )
          .catch(() => [])
      : [],
    loadDiscography(body, signal),
  ]);
  const artist = { ...page, ...discography };
  if (allTracks.length > 0) return { ...artist, tracks: allTracks };
  if (artist.tracks.length > 0) return artist;
  const channelId = channelIdOfArtist(artistId, body);
  if (!channelId) return artist;
  const uploads = await fetchChannelUploads(channelId, artistRef, signal).catch(
    () => [],
  );
  return uploads.length > 0 ? { ...artist, tracks: uploads } : artist;
}

async function getArtistImage(
  artistId: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  return mapInnertubeArtistDetails(
    artistId,
    await browse(artistId, undefined, signal),
  )?.cover?.url;
}

async function getArtist(
  artistId: string,
  signal?: AbortSignal,
): Promise<ArtistDetails> {
  const artist = await loadArtist(artistId, signal);
  if (artist) return artist;
  throw notFound("Artist");
}

function search(
  query: string,
  type: SearchType = "all",
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  return searchCatalog(query, type, signal);
}

export const innertubeCatalog = {
  search,
  getArtist,
  getArtistImage,
  getAlbum,
  getPlaylist,
  getTrack,
  getRadio,
};
