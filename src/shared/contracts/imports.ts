import type { Track } from './track';

export const IMPORT_SOURCES = ['youtube', 'soundcloud', 'spotify', 'deezer', 'apple_music'] as const;

export type ImportSource = typeof IMPORT_SOURCES[number];

export type ImportJobStatus = 'queued' | 'running' | 'awaiting_decision' | 'finalizing' | 'completed' | 'failed';

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
}

export interface ImportJob {
  id: string;
  source: ImportSource;
  sourceUrl: string;
  status: ImportJobStatus;
  requiresDecision: boolean;
  playlistId?: string;
  result?: ImportResult;
  queuePosition?: number;
  error?: { code: string; message: string };
  importToken?: string;
  workerWsUrl?: string;
  createdAt: Date | string;
  startedAt?: Date | string;
  finishedAt?: Date | string;
}

export interface ImportedTrack {
  sourceId: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  coverUrl?: string;
}

export interface ImportedPlaylist {
  source: ImportSource;
  sourceUrl: string;
  title: string;
  description?: string;
  tracks: ImportedTrack[];
}

export type ImportReviewReason =
  | 'auto_matched'
  | 'no_catalog_candidates'
  | 'low_confidence_match'
  | 'ambiguous_match'
  | 'duration_mismatch'
  | 'catalog_lookup_failed';

export interface ImportReview {
  id: string;
  sourceTrack: ImportedTrack;
  proposedTrack?: Track;
  score?: number;
  reason: ImportReviewReason;
  status: 'pending' | 'approved' | 'denied';
  position: number;
  createdAt: Date | string;
  reviewedAt?: Date | string;
}

export interface ImportReviewDecision {
  reviewId: string;
  decision: 'approve' | 'deny';
}

