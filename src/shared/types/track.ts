import type {
  TrackArtist as ContractTrackArtist,
  TrackAudioVariant,
} from "../contracts";

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
  audioVariant?: TrackAudioVariant;
  releaseDate?: string;
  addedAt?: string;
  album?: {
    id: string;
    title: string;
  };
  isRecommended?: boolean;
}
