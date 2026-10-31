import type { LocalTrackRecord } from "../../../../electron/local-tracks/types";
import type { Track } from "@/shared/types";
import { localTrackCoverUrl, toLocalTrackId } from "./localTrackIds";

export type {
  LocalImportResult,
  LocalLibraryUsage,
  LocalLyricsState,
  LocalTrackRecord,
} from "../../../../electron/local-tracks/types";

export function localRecordToTrack(record: LocalTrackRecord): Track {
  return {
    id: toLocalTrackId(record.id),
    title: record.title,
    artists: record.artist,
    coverUrl: record.coverFile ? localTrackCoverUrl(record.id) : "",
    durationMs: record.durationMs,
    playCount: 0,
  };
}
