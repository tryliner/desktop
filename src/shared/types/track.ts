import type { CatalogSource, TrackArtist as ContractTrackArtist } from "../contracts";

export interface TrackArtist {
  id?: string;
  name: string;
}

export interface Track {
  id: string;
  source?: CatalogSource;
  externalUrl?: string;
  playlistItemId?: string;
  title: string;
  artists: string;
  artistId?: string;
  artistList?: (ContractTrackArtist | TrackArtist)[];
  coverUrl: string;
  durationMs: number;
  playCount: number;
  explicit?: boolean;
  releaseDate?: string;
  album?: {
    id: string;
    title: string;
  };
}
