export type SavedLyricsState = "found" | "missing";

export interface SavedTrackMeta {
  trackId: string;
  title: string;
  artists: string;
  album?: string;
  albumId?: string;
  artistId?: string;
  durationMs: number;
  coverUrl?: string;
  explicit?: boolean;
}

export interface SavedTrackRecord extends SavedTrackMeta {
  key: string;
  audioFile: string;
  mimeType: string;
  coverFile?: string;
  byteSize: number;
  savedAt: number;
  lyrics?: SavedLyricsState;
}

export interface SavedTrackInput {
  meta: SavedTrackMeta;
  audio: Uint8Array;
  mimeType: string;
  cover?: { data: Uint8Array; mimeType: string };
  lyricsState?: SavedLyricsState;
  lyrics?: unknown;
}

export interface SavedLibraryUsage {
  count: number;
  bytes: number;
  freeBytes: number | null;
}
