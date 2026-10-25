import type { AlbumDetails, CatalogPlaylistDetails } from "@/shared/contracts";
import { isYoutubeSignedIn } from "../auth/youtubeAuthSession";
import { fetchYoutubeAccountPlaylist } from "../account/accountPlaylistDetails";
import { isAccountPlaylistId } from "../account/accountPlaylists";
import { InnertubeError, postInnertube } from "./innertubeClient";
import {
  mapInnertubeAlbumDetails,
  mapInnertubePlaylistDetails,
} from "./innertubeCollectionMapper";

const ALBUM_PLAYLIST_PREFIX = "OLAK5uy_";
const ALBUM_BROWSE_ID = /MPREb_[\w-]+/;

function browse(browseId: string, signal?: AbortSignal): Promise<unknown> {
  return postInnertube("browse", { browseId }, { signal });
}

function notFound(entity: string): InnertubeError {
  return new InnertubeError(`${entity} was not found.`, 404);
}

export function isAlbumPlaylistId(id: string): boolean {
  return id.startsWith(ALBUM_PLAYLIST_PREFIX);
}

async function resolveAlbumBrowseId(
  albumId: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!isAlbumPlaylistId(albumId)) return albumId;
  const body = await browse(`VL${albumId}`, signal);
  const browseId = JSON.stringify(body).match(ALBUM_BROWSE_ID)?.[0];
  if (!browseId) throw notFound("Album");
  return browseId;
}

export async function getAlbum(
  albumId: string,
  signal?: AbortSignal,
): Promise<AlbumDetails> {
  const browseId = await resolveAlbumBrowseId(albumId, signal);
  const album = mapInnertubeAlbumDetails(
    browseId,
    await browse(browseId, signal),
  );
  if (!album) throw notFound("Album");
  return album;
}

export async function getPlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<CatalogPlaylistDetails> {
  if (isYoutubeSignedIn() && isAccountPlaylistId(playlistId)) {
    const playlist = await fetchYoutubeAccountPlaylist(playlistId, signal);
    if (playlist) return playlist;
  }
  const browseId = /^(VL|MPRE|UC|FE)/.test(playlistId)
    ? playlistId
    : `VL${playlistId}`;
  const playlist = mapInnertubePlaylistDetails(
    playlistId,
    await browse(browseId, signal),
  );
  if (!playlist) throw notFound("Playlist");
  return playlist;
}
