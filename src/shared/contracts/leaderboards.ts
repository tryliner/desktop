export type LeaderboardType = 'artist' | 'global';
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntryUser {
  id: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user: LeaderboardEntryUser;
  playedDurationMs: number;
  playCount: number;
}

export interface LeaderboardResponse {
  type: LeaderboardType;
  targetId: string;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  updatedAt: string;
}
