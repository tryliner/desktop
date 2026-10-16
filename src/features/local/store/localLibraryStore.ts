import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Track } from "@/shared/types";

export interface LocalScanProgress {
  done: number;
  total: number;
}

interface LocalLibraryState {
  folder: string | null;
  tracks: Track[];
  scanning: boolean;
  progress: LocalScanProgress | null;
  error: string | null;
  chooseFolder: () => Promise<void>;
  rescan: () => Promise<void>;
  clear: () => void;
}

async function scan(folder: string, set: (p: Partial<LocalLibraryState>) => void) {
  const electron = window.linerElectron;
  if (!electron?.localScanFolder) {
    set({ error: "Local library needs the desktop app.", scanning: false });
    return;
  }
  set({ scanning: true, progress: null, error: null });
  const off = electron.onLocalScanProgress?.((p) => set({ progress: p }));
  try {
    const found = await electron.localScanFolder(folder);
    const tracks: Track[] = found.map((f) => ({
      id: f.id,
      title: f.title,
      artists: f.artists,
      coverUrl: f.coverUrl,
      durationMs: f.durationMs,
      playCount: 0,
      localUrl: f.url,
      releaseDate: f.year,
      album: f.album ? { id: f.albumId, title: f.album } : undefined,
    }));
    set({ tracks, scanning: false, progress: null });
  } catch (err) {
    set({ scanning: false, progress: null, error: err instanceof Error ? err.message : String(err) });
  } finally {
    off?.();
  }
}

export const useLocalLibraryStore = create<LocalLibraryState>()(
  persist(
    (set, get) => ({
      folder: null,
      tracks: [],
      scanning: false,
      progress: null,
      error: null,
      chooseFolder: async () => {
        const folder = await window.linerElectron?.localPickFolder?.();
        if (!folder) return;
        set({ folder, tracks: [] });
        await scan(folder, set);
      },
      rescan: async () => {
        const folder = get().folder;
        if (folder) await scan(folder, set);
      },
      clear: () => set({ folder: null, tracks: [], error: null }),
    }),
    {
      name: "liner_local_library_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ folder: s.folder, tracks: s.tracks }),
    },
  ),
);
