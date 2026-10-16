import { useCallback, useEffect, useState } from "react";
import { linerDb, type CachedTrackRecord } from "@/shared/storage";
// direct import: the connectivity wall uses this file and is itself imported by the api module
import { getAuthUserId } from "@/shared/api/auth-session";
import type { Track } from "@/shared/types";

export const DOWNLOADS_PLAYLIST_ID = "downloads";

export function cachedRecordToTrack(record: CachedTrackRecord): Track {
  return {
    id: record.id,
    title: record.title,
    artists: record.artists,
    coverUrl: record.coverUrl ?? "",
    durationMs: record.durationMs ?? 0,
    playCount: 0,
    album:
      record.albumId && record.albumTitle
        ? { id: record.albumId, title: record.albumTitle }
        : undefined,
  };
}

// only the signed-in account's tracks: the audio cache is shared by every account on the machine
export async function loadDownloadedTracks(
  ownerId: string | null = getAuthUserId(),
): Promise<Track[]> {
  if (!ownerId) return [];
  try {
    const records = await linerDb.getDownloadedTracks(ownerId);
    return records.map(cachedRecordToTrack);
  } catch {
    return [];
  }
}

// tracks whose audio is already on disk, playable without the server
export function useDownloadedTracks(enabled: boolean = true) {
  const ownerId = getAuthUserId();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const next = await loadDownloadedTracks(ownerId);
    setTracks(next);
    setIsLoading(false);
  }, [ownerId]);

  useEffect(() => {
    if (!enabled) {
      setTracks(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setTracks(null);
    void loadDownloadedTracks(ownerId).then((next) => {
      if (!active) return;
      setTracks(next);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [enabled, ownerId]);

  // the page is not remounted between playlist ids, so cover the render before the effect runs
  return { data: tracks, isLoading: enabled && (isLoading || tracks === null), refresh };
}
