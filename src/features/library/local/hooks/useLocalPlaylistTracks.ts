import { useEffect, useMemo } from "react";
import { localRecordToTrack, toLocalTrackId } from "@/shared/media/local";
import type { Track } from "@/shared/types";
import { useLocalLibraryStore } from "../store/localLibraryStore";
import { useLocalPlaylistLinksStore } from "../store/localPlaylistLinksStore";

const NONE: never[] = [];

export function useLocalPlaylistTracks(playlistId: string | null | undefined) {
  const entries = useLocalPlaylistLinksStore((state) =>
    playlistId ? (state.links[playlistId] ?? NONE) : NONE,
  );
  const linksLoaded = useLocalPlaylistLinksStore((state) => state.loaded);
  const loadLinks = useLocalPlaylistLinksStore((state) => state.load);
  const records = useLocalLibraryStore((state) => state.records);
  const loadState = useLocalLibraryStore((state) => state.loadState);
  const loadLibrary = useLocalLibraryStore((state) => state.load);

  useEffect(() => {
    if (!linksLoaded) void loadLinks();
  }, [linksLoaded, loadLinks]);

  useEffect(() => {
    if (loadState === "idle") void loadLibrary();
  }, [loadState, loadLibrary]);

  return useMemo(() => {
    const known = new Map(records.map((record) => [record.id, record]));
    // until the library has loaded, don't flash everything as missing
    const settled = loadState === "ready" || loadState === "unavailable";
    const available: Track[] = [];
    const missing: Track[] = [];
    for (const entry of entries) {
      const record = known.get(entry.fileId);
      if (record) {
        available.push(localRecordToTrack(record));
      } else if (settled) {
        missing.push({
          id: toLocalTrackId(entry.fileId),
          title: entry.title,
          artists: entry.artist,
          coverUrl: "",
          durationMs: entry.durationMs,
          playCount: 0,
        });
      }
    }
    return { available, missing };
  }, [entries, records, loadState]);
}
