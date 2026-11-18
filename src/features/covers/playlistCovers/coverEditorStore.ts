import { create } from "zustand";

interface CoverEditorState {
  open: boolean;
  playlistId: string | null;
  playlistTitle: string;
  /** covers of the playlist's songs, offered as one-click picks */
  trackCovers: string[];
  /** a file dropped on the hero opens the editor already loaded with it */
  initialFile: File | null;
  openEditor: (input: {
    playlistId: string;
    playlistTitle: string;
    trackCovers?: string[];
    file?: File | null;
  }) => void;
  close: () => void;
}

export const useCoverEditorStore = create<CoverEditorState>((set) => ({
  open: false,
  playlistId: null,
  playlistTitle: "",
  trackCovers: [],
  initialFile: null,
  openEditor: ({ playlistId, playlistTitle, trackCovers = [], file = null }) =>
    set({
      open: true,
      playlistId,
      playlistTitle,
      trackCovers: [...new Set(trackCovers.filter(Boolean))].slice(0, 12),
      initialFile: file,
    }),
  close: () =>
    set({ open: false, playlistId: null, initialFile: null, trackCovers: [] }),
}));
