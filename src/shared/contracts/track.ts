import type { Cover } from "./cover";

export interface TrackArtist {
  id: string;
  name: string;
}

export interface TrackAlbum {
  id: string;
  title: string;
}

export type TrackAudioVariant = "music-video" | "premium-only";

export interface Track {
  id: string;
  title: string;
  artists: TrackArtist[];
  album?: TrackAlbum;
  durationMs: number;
  cover?: Cover;
  explicit?: boolean;
  audioVariant?: TrackAudioVariant;
  isRecommended?: boolean;
}

export interface ApiTrack extends Track {
  type?: "track";
  viewer?: {
    liked: boolean;
  };
}

export interface TrackDetails extends Track {
  description?: string;
  releaseDate?: string;
  viewer?: {
    liked: boolean;
  };
  relatedTracks?: Track[];
}

export type ApiTrackDetails = TrackDetails;
