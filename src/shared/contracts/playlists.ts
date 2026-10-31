import type { Cover } from "./cover";
import type { Track, ApiTrack } from "./track";

export interface PlaylistSummary {
  id: string;
  title: string;
  description?: string;
  revision: number;
  trackCount: number;
  durationMs: number;
  cover?: Cover;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type ApiPlaylistSummary = PlaylistSummary;

export interface PlaylistDetails extends PlaylistSummary {
  tracks: Track[];
}

export type ApiPlaylistDetails = PlaylistDetails;

export interface UserPlaylist {
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  trackCount?: number;
  coverUrls?: string[];
  ownerId?: string;
  owner?: {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

export type ApiUserPlaylist = UserPlaylist;

export interface UserPlaylistItem {
  id: string;
  track: ApiTrack;
  position: number;
  addedAt: string;
}

export type ApiUserPlaylistItem = UserPlaylistItem;

// GET /v1/playlists/:id: a public user playlist, or one the viewer owns
export interface SharedPlaylistDetails extends UserPlaylist {
  trackCount: number;
  durationMs: number;
  items: UserPlaylistItem[];
}

export type ApiSharedPlaylistDetails = SharedPlaylistDetails;

const USER_PLAYLIST_ID =
  /^(?:[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}|pl-.+)$/;

// user playlists are uuids (or legacy pl-…), catalog ones are VLPL…/PL…
export function isUserPlaylistId(id: string): boolean {
  return USER_PLAYLIST_ID.test(id);
}

export interface LikedTracksPage {
  items: { track: ApiTrack; likedAt: string }[];
  nextCursor: string | null;
}

export type ApiLikedTracksPage = LikedTracksPage;
