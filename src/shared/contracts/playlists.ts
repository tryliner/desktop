import type { Cover } from './cover';
import type { Track, ApiTrack } from './track';

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

export interface LikedTracksPage {
  items: { track: ApiTrack; likedAt: string }[];
  nextCursor: string | null;
}

export type ApiLikedTracksPage = LikedTracksPage;
