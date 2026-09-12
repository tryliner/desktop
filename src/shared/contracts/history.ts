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

export type PopularTimeWindow = '24h' | '7d' | '30d' | 'all';

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
