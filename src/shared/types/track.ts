import type { TrackArtist as ContractTrackArtist } from "../contracts";

export interface TrackArtist {
  id?: string;
  name: string;
}

export interface Track {
  id: string;
  playlistItemId?: string;
  title: string;
  artists: string;
  artistId?: string;
  artistList?: (ContractTrackArtist | TrackArtist)[];
  coverUrl: string;
  durationMs: number;
  playCount: number;
  explicit?: boolean;
  /** set for tracks from the user's local library (liner-local:// stream URL) */
  localUrl?: string;
  releaseDate?: string;
  album?: {
    id: string;
    title: string;
  };
}
