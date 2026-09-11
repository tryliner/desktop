import { create } from "zustand";
import type { ImportReview } from "@/shared/api";

export interface LibraryItemDetail {
  id: string;
  title: string;
  coverUrl: string;
  type: "album" | "artist" | "playlist";
  subtitle?: string;
  totalTracks?: number;
}

export interface PlaylistOption {
  id: string;
  title: string;
  description?: string;
  coverUrl: string;
  trackCount: number;
}

export interface TrackDetail {
  id: string;
  title: string;
  artists: string;
  coverUrl: string;
  duration?: string;
  durationMs?: number;
  playlists?: PlaylistOption[];
}

export interface RemoveLibraryDetail {
  id: string;
  title: string;
  coverUrl: string;
  type: "album" | "artist" | "playlist";
  subtitle?: string;
}

export interface RemovePlaylistDetail {
  trackId: string;
  playlistItemId?: string;
  trackTitle: string;
  trackArtists: string;
  trackCoverUrl: string;
  playlistId?: string;
  playlistTitle?: string;
}

interface ModalState {
  // Add to library
  addToLibraryOpen: boolean;
  addToLibraryItem: LibraryItemDetail | null;
  openAddToLibrary: (item: LibraryItemDetail) => void;
  closeAddToLibrary: () => void;

  // Add to playlist
  addToPlaylistOpen: boolean;
  addToPlaylistTrack: TrackDetail | null;
  openAddToPlaylist: (track: TrackDetail) => void;
  closeAddToPlaylist: () => void;

  // Create playlist
  createPlaylistOpen: boolean;
  createPlaylistInitialUrl: string;
  createPlaylistPendingTrack: TrackDetail | null;
  openCreatePlaylist: (initialUrl?: string, pendingTrack?: TrackDetail | null) => void;
  closeCreatePlaylist: () => void;

  // Remove from library
  removeFromLibraryOpen: boolean;
  removeFromLibraryDetail: RemoveLibraryDetail | null;
  openRemoveFromLibrary: (detail: RemoveLibraryDetail) => void;
  closeRemoveFromLibrary: () => void;

  // Remove from playlist
  removeFromPlaylistOpen: boolean;
  removeFromPlaylistDetail: RemovePlaylistDetail | null;
  openRemoveFromPlaylist: (detail: RemovePlaylistDetail) => void;
  closeRemoveFromPlaylist: () => void;

  // Import SoundCloud likes
  importLikesOpen: boolean;
  importLikesInitialUsername: string;
  openImportLikes: (initialUsername?: string) => void;
  closeImportLikes: () => void;

  // Import Review / Decisions
  importReviewOpen: boolean;
  importReviewJobId: string | null;
  importReviewPrefetched: ImportReview[] | null;
  openImportReview: (jobId: string, prefetchedItems?: ImportReview[]) => void;
  closeImportReview: () => void;

  // Search modal / panel
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;

  // Settings modal
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  addToLibraryOpen: false,
  addToLibraryItem: null,
  openAddToLibrary: (item) =>
    set({ addToLibraryOpen: true, addToLibraryItem: item }),
  closeAddToLibrary: () =>
    set({ addToLibraryOpen: false, addToLibraryItem: null }),

  addToPlaylistOpen: false,
  addToPlaylistTrack: null,
  openAddToPlaylist: (track) =>
    set({ addToPlaylistOpen: true, addToPlaylistTrack: track }),
  closeAddToPlaylist: () =>
    set({ addToPlaylistOpen: false, addToPlaylistTrack: null }),

  createPlaylistOpen: false,
  createPlaylistInitialUrl: "",
  createPlaylistPendingTrack: null,
  openCreatePlaylist: (initialUrl = "", pendingTrack = null) =>
    set({
      createPlaylistOpen: true,
      createPlaylistInitialUrl: initialUrl,
      createPlaylistPendingTrack: pendingTrack,
    }),
  closeCreatePlaylist: () =>
    set({
      createPlaylistOpen: false,
      createPlaylistInitialUrl: "",
      createPlaylistPendingTrack: null,
    }),

  removeFromLibraryOpen: false,
  removeFromLibraryDetail: null,
  openRemoveFromLibrary: (detail) =>
    set({ removeFromLibraryOpen: true, removeFromLibraryDetail: detail }),
  closeRemoveFromLibrary: () =>
    set({ removeFromLibraryOpen: false, removeFromLibraryDetail: null }),

  removeFromPlaylistOpen: false,
  removeFromPlaylistDetail: null,
  openRemoveFromPlaylist: (detail) =>
    set({ removeFromPlaylistOpen: true, removeFromPlaylistDetail: detail }),
  closeRemoveFromPlaylist: () =>
    set({ removeFromPlaylistOpen: false, removeFromPlaylistDetail: null }),

  importLikesOpen: false,
  importLikesInitialUsername: "",
  openImportLikes: (initialUsername = "") =>
    set({ importLikesOpen: true, importLikesInitialUsername: initialUsername }),
  closeImportLikes: () =>
    set({ importLikesOpen: false, importLikesInitialUsername: "" }),

  importReviewOpen: false,
  importReviewJobId: null,
  importReviewPrefetched: null,
  openImportReview: (jobId, prefetchedItems) =>
    set({
      importReviewOpen: true,
      importReviewJobId: jobId,
      importReviewPrefetched: prefetchedItems?.length ? prefetchedItems : null,
    }),
  closeImportReview: () =>
    set({
      importReviewOpen: false,
      importReviewJobId: null,
      importReviewPrefetched: null,
    }),

  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),

  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
}));
