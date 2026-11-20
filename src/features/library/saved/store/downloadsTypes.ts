import type { Track } from "@/shared/types";

export const DOWNLOADS_KEY = "liner_downloads_v1";

export type PinnedTrack = Pick<
  Track,
  "id" | "title" | "artists" | "coverUrl" | "durationMs"
> &
  Partial<Pick<Track, "explicit" | "artistId">>;

export type CollectionKind = "playlist" | "album";

export interface PinnedCollection {
  id: string;
  kind: CollectionKind;
  title: string;
  coverUrl: string;
  tracks: PinnedTrack[];
  pinnedAt: number;
}

export interface AccountDownloads {
  tracks: Record<string, PinnedTrack & { pinnedAt: number }>;
  collections: Record<string, PinnedCollection>;
}

export interface DownloadProgress {
  trackId: string;
  received: number;
  total: number | null;
}
