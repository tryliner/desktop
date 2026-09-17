import type { Cover } from './cover';
import type { Track } from './track';

export interface WaveRecommendationRequest {
  k?: number;
  history?: string[];
  waveId?: string;
  driftRate?: number;
  temperature?: number;
}

export interface WaveRecommendationResponse {
  waveId?: string;
  items: Track[];
  source: 'recommender-wave' | 'history-seeds' | 'popular-fallback';
  count: number;
}

export interface DailyMixItem {
  id: string;
  title: string;
  description: string;
  clusterArtists: string[];
  cover?: Cover;
  trackCount: number;
  tracks: Track[];
}

export interface DailyMixesResponse {
  items: DailyMixItem[];
  generatedAt: string;
}

export interface UserTasteProfile {
  userId: string;
  topSeedTracks: Track[];
  topArtists: Array<{ name: string; score: number }>;
  recentSkipTrackIds: string[];
}
