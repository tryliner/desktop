import type { Track } from "@/shared/types";

export const ESTIMATED_BYTES_PER_MS = 160_000 / 8 / 1000;

export function estimateBytes(tracks: Pick<Track, "durationMs">[]): number {
  return Math.round(
    tracks.reduce(
      (sum, track) => sum + Math.max(0, track.durationMs || 210_000),
      0,
    ) * ESTIMATED_BYTES_PER_MS,
  );
}
