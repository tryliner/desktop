import type { PlaybackHistoryItem } from "@/shared/contracts/history";
import type { Track } from "@/shared/types";
import type { UserListeningStats, ComputeStatsOptions } from "./types";

export function extractArtistName(track: any): string {
  if (typeof track?.artists === "string" && track.artists.trim()) {
    return track.artists.trim();
  }
  if (Array.isArray(track?.artists) && track.artists.length > 0) {
    const names = track.artists
      .map((a: any) => (typeof a === "string" ? a : a?.name || ""))
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (Array.isArray(track?.artistList) && track.artistList.length > 0) {
    const names = track.artistList
      .map((a: any) => (typeof a === "string" ? a : a?.name || ""))
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  return "Unknown Artist";
}

export function computeListeningStats(
  history: PlaybackHistoryItem[] | null | undefined,
  options: ComputeStatsOptions = {}
): UserListeningStats {
  const precision = options.precision ?? 2;
  const topLimit = options.topLimit ?? 10;

  if (!Array.isArray(history) || history.length === 0) {
    return {
      totalHoursListened: 0,
      totalTracksPlayed: 0,
      topTracks: [],
      topArtists: [],
      calculatedAt: new Date().toISOString(),
    };
  }

  let totalPlayedMs = 0;
  const trackMap = new Map<string, { track: Track; playCount: number; totalPlayedMs: number }>();
  const artistMap = new Map<string, number>();

  for (const item of history) {
    if (!item || !item.track) continue;

    const playedMs =
      typeof item.playedDurationMs === "number" &&
      !Number.isNaN(item.playedDurationMs) &&
      item.playedDurationMs > 0
        ? item.playedDurationMs
        : 0;

    totalPlayedMs += playedMs;

    const trackKey = item.track.id || item.track.title || "unknown_track";
    const existing = trackMap.get(trackKey) ?? {
      track: item.track as unknown as Track,
      playCount: 0,
      totalPlayedMs: 0,
    };
    existing.playCount += 1;
    existing.totalPlayedMs += playedMs;
    trackMap.set(trackKey, existing);

    const artistName = extractArtistName(item.track);
    artistMap.set(artistName, (artistMap.get(artistName) ?? 0) + 1);
  }

  const topTracks = Array.from(trackMap.values())
    .sort(
      (a, b) =>
        b.playCount - a.playCount ||
        b.totalPlayedMs - a.totalPlayedMs ||
        (a.track.title || "").localeCompare(b.track.title || "")
    )
    .slice(0, topLimit);

  const topArtists = Array.from(artistMap.entries())
    .map(([artistName, playCount]) => ({ artistName, playCount }))
    .sort((a, b) => b.playCount - a.playCount || a.artistName.localeCompare(b.artistName))
    .slice(0, topLimit);

  const factor = Math.pow(10, precision);
  const rawHours = totalPlayedMs / (1000 * 60 * 60);
  const totalHoursListened = Number.isNaN(rawHours)
    ? 0
    : Math.round(rawHours * factor) / factor;

  return {
    totalHoursListened,
    totalTracksPlayed: history.length,
    topTracks,
    topArtists,
    calculatedAt: new Date().toISOString(),
  };
}

export function formatListeningHours(hours: number): string {
  if (!hours || Number.isNaN(hours) || hours <= 0) return "0 hrs";
  return `${hours.toFixed(1)} hrs`;
}
