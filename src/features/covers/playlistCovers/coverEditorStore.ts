import { create } from "zustand";

interface CoverEditorState {
  open: boolean;
  playlistId: string | null;
  playlistTitle: string;
  currentCover: string | null;
  trackCovers: string[];
  initialFile: File | null;
  openEditor: (input: {
    playlistId: string;
    playlistTitle: string;
    currentCover?: string | null;
    trackCovers?: string[];
    file?: File | null;
  }) => void;
  close: () => void;
}

const MAX_SONG_PICKS = 12;

export const useCoverEditorStore = create<CoverEditorState>((set) => ({
  open: false,
  playlistId: null,
  playlistTitle: "",
  currentCover: null,
  trackCovers: [],
  initialFile: null,
  openEditor: ({
    playlistId,
    playlistTitle,
    currentCover = null,
    trackCovers = [],
    file = null,
  }) =>
    set({
      open: true,
      playlistId,
      playlistTitle,
      currentCover,
      trackCovers: [...new Set(trackCovers.filter(Boolean))].slice(
        0,
        MAX_SONG_PICKS,
      ),
      initialFile: file,
    }),
  close: () =>
    set({
      open: false,
      playlistId: null,
      currentCover: null,
      initialFile: null,
      trackCovers: [],
    }),
}));
