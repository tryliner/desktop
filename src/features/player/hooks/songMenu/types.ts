import type { usePlaylistsList } from "@/features/library";
import type { useTranslation } from "@/languages";

export type Translate = ReturnType<typeof useTranslation>["t"];

export interface SongMenuContext {
  id?: string;
  title: string;
  artists: string;
  coverUrl: string;
  duration?: string;
  durationMs?: number;
  searchType?: "track" | "album" | "artist" | "playlist";
  totalTracks?: number;
  playlistId?: string;
  playlistItemId?: string;
  playlistTitle?: string;
  onRemoveFromQueue?: () => void;
  onRemoveFromDevice?: () => void;
  onRemoveFromPlaylist?: () => Promise<void>;
}

export interface SongMenuActions {
  liked: boolean;
  handleLike: () => void;
  handleShare: () => void;
  playlistsData: ReturnType<typeof usePlaylistsList>["data"];
}
