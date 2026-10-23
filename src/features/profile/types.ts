import type { Track } from "@/shared/types";
import type { PublicUser } from "@/shared/contracts";

export interface TopTrackItem {
  track: Track;
  playCount: number;
  totalPlayedMs: number;
}

export interface TopArtistItem {
  artistName: string;
  playCount: number;
}

export interface UserListeningStats {
  totalHoursListened: number;
  totalTracksPlayed: number;
  topTracks: TopTrackItem[];
  topArtists: TopArtistItem[];
  calculatedAt: string;
}

export interface ComputeStatsOptions {
  precision?: number;
  topLimit?: number;
}

export interface AvatarPreset {
  id: string;
  name: string;
  url: string;
  accentColor?: string;
}

export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: {
    handle?: string;
    bio?: string;
    displayName?: string;
  };
}

export interface UserProfileModel extends Partial<PublicUser> {
  id: string;
  username: string;
  handle: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  isGuest?: boolean;
  isPublic?: boolean;
}
