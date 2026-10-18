import { create } from "zustand";
import type { Track } from "@/shared/types";

export interface LocalScanProgress {
  done: number;
  total: number;
}

type ScannedTrack = Awaited<ReturnType<NonNullable<Window["linerElectron"]>["localScanFolder"]>>[number];

interface LocalLibraryState {
  folder: string | null;
  tracks: Track[];
  loaded: boolean;
  scanning: boolean;
  progress: LocalScanProgress | null;
  error: "desktop_only" | "scan_failed" | null;
  load: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  rescan: () => Promise<void>;
}

function toTrack(f: ScannedTrack): Track {
  return {
    id: f.id,
    title: f.title,
    artists: f.artists,
    coverUrl: f.coverUrl,
    durationMs: f.durationMs,
    playCount: 0,
    localUrl: f.url,
    releaseDate: f.year,
    album: f.album ? { id: f.albumId, title: f.album } : undefined,
  };
}

/**
 * Nothing here is persisted by the renderer: the picked folder and the scanned list live in the
 * main process (userData), so scan progress updates never serialize the whole library.
 */
export const useLocalLibraryStore = create<LocalLibraryState>()((set, get) => {
  async function scan(folder: string) {
    const electron = window.linerElectron;
    if (!electron?.localScanFolder) {
      set({ error: "desktop_only", scanning: false });
      return;
    }
    set({ scanning: true, progress: null, error: null });
    const off = electron.onLocalScanProgress?.((p) => set({ progress: p }));
    try {
      const found = await electron.localScanFolder(folder);
      set({ tracks: found.map(toTrack), scanning: false, progress: null });
    } catch {
      set({ scanning: false, progress: null, error: "scan_failed" });
    } finally {
      off?.();
    }
  }

  return {
    folder: null,
    tracks: [],
    loaded: false,
    scanning: false,
    progress: null,
    error: null,

    load: async () => {
      if (get().loaded) return;
      set({ loaded: true });
      const cached = await window.linerElectron?.localLoadLibrary?.();
      if (cached) set({ folder: cached.folder, tracks: cached.tracks.map(toTrack) });
    },

    chooseFolder: async () => {
      const folder = await window.linerElectron?.localPickFolder?.();
      if (!folder) return;
      set({ folder, tracks: [] });
      await scan(folder);
    },

    rescan: async () => {
      const folder = get().folder;
      if (folder) await scan(folder);
    },
  };
});
