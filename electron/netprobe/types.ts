export type YoutubeFailure = "timeout" | "blocked";

export interface NetProbeResult {
  internet: boolean;
  youtube: boolean;
  youtubeFailure: YoutubeFailure | null;
  country: string | null;
}
