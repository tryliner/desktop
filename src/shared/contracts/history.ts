import type { Track } from './track';

export type PlaybackContextType =
  | 'album'
  | 'playlist'
  | 'radio'
  | 'search'
  | 'library'
  | 'explore'
  | 'direct';

export interface PlaybackContext {
  type: PlaybackContextType | string;
  id?: string;
}

export interface RecordPlaybackEventRequest {
  playbackSessionId: string;
  listeningSessionId: string;
  trackId: string;
  trackSnapshot?: Track;
  playedDurationMs: number;
  trackDurationMs?: number;
  completionRate: number;
  completed?: boolean;
  skipped?: boolean;
  loopCount?: number;
  hasSeekBackward?: boolean;
  context?: PlaybackContext;
}

export interface PlaybackHistoryItem {
  id: string;
  playbackSessionId: string;
  listeningSessionId: string;
  track: Track;
  playedDurationMs: number;
  completionRate: number;
  completed: boolean;
  skipped: boolean;
  loopCount: number;
  hasSeekBackward: boolean;
  context?: PlaybackContext;
  listenedAt: string;
}

export interface PlaybackHistoryResponse {
  items: PlaybackHistoryItem[];
  nextCursor: string | null;
}

export type PopularTimeWindow = '12h' | '24h' | '7d' | '30d' | 'all';

export interface PopularTrackItem {
  rank: number;
  track: Track;
  playCount: number;
  uniqueListeners: number;
  score: number;
  viewer?: {
    liked: boolean;
  };
}

export interface PopularTracksResponse {
  window: PopularTimeWindow;
  generatedAt: string;
  items: PopularTrackItem[];
}


export interface PopularAlbumEntry {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  year?: number;
  playCount: number;
  uniqueListeners: number;
  trackCount: number;
  score: number;
}

export interface PopularAlbumsResponse {
  window: PopularTimeWindow;
  items: PopularAlbumEntry[];
}

export type MostSavedType = "all" | "album" | "playlist";

export interface MostSavedEntry {
  type: "album" | "playlist";
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string | null;
  saves: number;
}

export interface MostSavedResponse {
  type: MostSavedType;
  items: MostSavedEntry[];
}
