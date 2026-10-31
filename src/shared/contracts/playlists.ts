import type {
  AddTracksResult,
  LikedTracksPage,
  Playlist,
  PlaylistDetails,
  PlaylistItem,
  PlaylistOwner,
} from "./api.generated";

export type { AddTracksResult, LikedTracksPage, PlaylistOwner };

/** A user playlist: the same object in the list, create, update, move and details. */
export type UserPlaylist = Playlist;

/** One track of a user playlist; `id` is the item id (remove / move). */
export type UserPlaylistItem = PlaylistItem;

/**
 * `GET /v1/me/playlists/:id` and `GET /v1/playlists/:id` (public, or the
 * viewer's own): the playlist, its owner and a page of items.
 */
export type UserPlaylistDetails = PlaylistDetails;

const USER_PLAYLIST_ID =
  /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/;

// user playlists are uuids, catalog ones are VLPL…/PL…
export function isUserPlaylistId(id: string): boolean {
  return USER_PLAYLIST_ID.test(id);
}
