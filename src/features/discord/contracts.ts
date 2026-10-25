export type DiscordStatusDisplayType =
  "artist" | "title" | "artist_title" | "title_artist" | "app";

export interface DiscordRpcSettings {
  enabled: boolean;
  statusDisplayType: DiscordStatusDisplayType;
  showArtwork: boolean;
  showArtistSmallImage: boolean;
  showTime: boolean;
  showPaused: boolean;
  showButton: boolean;
  showDownloadButton: boolean;
}

export interface DiscordRpcTrackInfo {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  coverUrl?: string;
  durationMs: number;
}

export interface DiscordRpcStatePayload {
  status: "playing" | "paused" | "loading" | "buffering" | "idle" | "error";
  track: DiscordRpcTrackInfo | null;
  positionMs: number;
  durationMs: number;
  artistImageUrl?: string;
}

export const DEFAULT_DISCORD_SETTINGS: DiscordRpcSettings = {
  enabled: true,
  statusDisplayType: "artist",
  showArtwork: true,
  showArtistSmallImage: true,
  showTime: true,
  showPaused: true,
  showButton: true,
  showDownloadButton: true,
};

export interface DiscordConnectionStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  viaArrpc?: boolean;
}
