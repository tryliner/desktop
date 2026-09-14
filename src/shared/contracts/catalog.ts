import type { Cover } from './cover';
import type { Track, ApiTrack } from './track';

export type SearchType = 'all' | 'track' | 'artist' | 'album' | 'playlist';

export const SEARCH_TYPES: readonly SearchType[] = ['all', 'track', 'artist', 'album', 'playlist'];

export interface SearchArtistItem {
  type: 'artist';
  id: string;
  name: string;
  cover?: Cover;
}

export interface SearchAlbumItem {
  type: 'album';
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  year?: number;
  cover?: Cover;
}

export interface SearchPlaylistItem {
  type: 'playlist';
  id: string;
  title: string;
  author?: string;
  cover?: Cover;
}

export type SearchResult =
  | (Track & { type: 'track'; viewer?: { liked: boolean } })
  | SearchArtistItem
  | SearchAlbumItem
  | SearchPlaylistItem;

export type ApiSearchItem = SearchResult;
export type SearchResponse = { items: ApiSearchItem[] };
export type ApiArtist = SearchArtistItem;
export type ApiAlbum = SearchAlbumItem;
export type ApiPlaylist = SearchPlaylistItem;

export interface ArtistAlbum {
  id: string;
  title: string;
  year?: number;
  cover?: Cover;
  explicit?: boolean;
}

export type ApiArtistAlbum = ArtistAlbum;

export interface ArtistRelease extends ArtistAlbum {
  releaseType: 'single' | 'ep';
}

export type ApiArtistRelease = ArtistRelease;

export interface ArtistDetails {
  type: 'artist';
  id: string;
  name: string;
  bio?: string;
  cover?: Cover;
  monthlyListeners?: string;
  verified: boolean;
  geniusImageUrl?: string;
  geniusAka?: string[];
  geniusUsername?: string;
  tracks: ApiTrack[];
  albums: ArtistAlbum[];
  singles: ArtistRelease[];
}

export type ApiArtistDetails = ArtistDetails;

export interface AlbumDetails {
  type: 'album';
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  year?: number;
  cover?: Cover;
  trackCount?: number;
  durationMs?: number;
  tracks: ApiTrack[];
}

export type ApiAlbumDetails = AlbumDetails;

export interface CatalogPlaylistDetails {
  type: 'playlist';
  id: string;
  title: string;
  author?: string;
  description?: string;
  year?: number;
  cover?: Cover;
  trackCount?: number;
  durationMs?: number;
  tracks: ApiTrack[];
}

export type ApiCatalogPlaylistDetails = CatalogPlaylistDetails;

export interface RadioTrack {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album?: { id: string; title: string };
  durationMs: number;
  cover?: Cover;
  explicit?: boolean;
}

export type ApiRadioTrack = RadioTrack;
export type RadioResponse = { items: ApiRadioTrack[] };
