import type {
  SavedTrackMeta,
  SavedTrackRecord,
} from "../../../../electron/saved-tracks/types";
import type { Track } from "@/shared/types";

export type {
  SavedLibraryUsage,
  SavedLyricsState,
  SavedTrackInput,
  SavedTrackMeta,
  SavedTrackRecord,
} from "../../../../electron/saved-tracks/types";

let byTrackId = new Map<string, SavedTrackRecord>();

export function setSavedTrackIndex(records: SavedTrackRecord[]): void {
  byTrackId = new Map(records.map((record) => [record.trackId, record]));
}

export function savedTrackRecord(
  trackId: string | null | undefined,
): SavedTrackRecord | undefined {
  return trackId ? byTrackId.get(trackId) : undefined;
}

export function isSavedTrack(trackId: string | null | undefined): boolean {
  return Boolean(trackId && byTrackId.has(trackId));
}

export function savedAudioUrl(record: SavedTrackRecord): string {
  return `liner-local://saved-audio/${record.key}`;
}

export function savedCoverUrl(record: SavedTrackRecord): string {
  return `liner-local://saved-cover/${record.key}`;
}

export function trackToSavedMeta(track: Track): SavedTrackMeta {
  return {
    trackId: track.id,
    title: track.title,
    artists: track.artists,
    durationMs: track.durationMs,
    ...(track.album?.title ? { album: track.album.title } : {}),
    ...(track.album?.id ? { albumId: track.album.id } : {}),
    ...(track.artistId ? { artistId: track.artistId } : {}),
    ...(track.coverUrl ? { coverUrl: track.coverUrl } : {}),
    ...(track.explicit ? { explicit: true } : {}),
  };
}

export function savedRecordToTrack(record: SavedTrackRecord): Track {
  return {
    id: record.trackId,
    title: record.title,
    artists: record.artists,
    ...(record.artistId ? { artistId: record.artistId } : {}),
    coverUrl: record.coverFile
      ? savedCoverUrl(record)
      : (record.coverUrl ?? ""),
    durationMs: record.durationMs,
    playCount: 0,
    ...(record.explicit ? { explicit: true } : {}),
    ...(record.albumId && record.album
      ? { album: { id: record.albumId, title: record.album } }
      : {}),
  };
}

export async function readSavedLyrics<T>(
  trackId: string,
  isValid: (value: unknown) => value is T,
): Promise<T | null> {
  if (!isSavedTrack(trackId)) return null;
  const stored = await window.linerElectron
    ?.savedTracksGetLyrics(trackId)
    .catch(() => null);
  return isValid(stored) ? stored : null;
}
