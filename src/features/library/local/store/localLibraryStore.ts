import { create } from "zustand";
import {
  isLocalTrackId,
  localRecordToTrack,
  toLocalTrackId,
  type LocalImportResult,
  type LocalTrackRecord,
} from "@/shared/media/local";
import { playerEngine } from "@/features/player/engine/playerEngine";

async function releasePlayingTrack(fileIds: string[] | "all") {
  const current = playerEngine.getSnapshot().currentTrack?.id;
  if (!current || !isLocalTrackId(current)) return;
  const removed =
    fileIds === "all" || fileIds.map(toLocalTrackId).includes(current);
  if (removed) await playerEngine.stopAndClear().catch(() => {});
}
import type { Track } from "@/shared/types";

type LoadState = "idle" | "loading" | "ready" | "unavailable";

interface LocalLibraryState {
  records: LocalTrackRecord[];
  tracks: Track[];
  loadState: LoadState;
  importing: boolean;
  load: () => Promise<void>;
  importPaths: (paths: string[]) => Promise<LocalImportResult | null>;
  pickFiles: () => Promise<LocalImportResult | null>;
  remove: (fileIds: string[]) => Promise<void>;
  removeAll: () => Promise<number>;
}

const newestFirst = (records: LocalTrackRecord[]) =>
  [...records].sort((a, b) => b.addedAt - a.addedAt);

const withTracks = (records: LocalTrackRecord[]) => {
  const sorted = newestFirst(records);
  return { records: sorted, tracks: sorted.map(localRecordToTrack) };
};

export const useLocalLibraryStore = create<LocalLibraryState>((set, get) => {
  const runImport = async (
    request: () => Promise<LocalImportResult | null>,
  ): Promise<LocalImportResult | null> => {
    set({ importing: true });
    try {
      const result = await request();
      if (result && result.added.length > 0) {
        set(withTracks([...get().records, ...result.added]));
      }
      return result;
    } finally {
      set({ importing: false });
    }
  };

  return {
    records: [],
    tracks: [],
    loadState: "idle",
    importing: false,

    load: async () => {
      const bridge = window.linerElectron;
      if (!bridge) {
        set({ loadState: "unavailable" });
        return;
      }
      if (get().loadState === "loading") return;
      set({ loadState: "loading" });
      try {
        const records = await bridge.localTracksList();
        set({ ...withTracks(records), loadState: "ready" });
      } catch {
        set({ loadState: "ready" });
      }
    },

    importPaths: (paths) => {
      const bridge = window.linerElectron;
      if (!bridge || paths.length === 0) return Promise.resolve(null);
      return runImport(() => bridge.localTracksImport(paths));
    },

    pickFiles: () => {
      const bridge = window.linerElectron;
      if (!bridge) return Promise.resolve(null);
      return runImport(() => bridge.localTracksPick());
    },

    remove: async (fileIds) => {
      const bridge = window.linerElectron;
      if (!bridge || fileIds.length === 0) return;
      const removing = new Set(fileIds);
      set(
        withTracks(get().records.filter((record) => !removing.has(record.id))),
      );
      await releasePlayingTrack(fileIds);
      await bridge.localTracksRemove(fileIds);
    },

    removeAll: async () => {
      const bridge = window.linerElectron;
      if (!bridge) return 0;
      set(withTracks([]));
      await releasePlayingTrack("all");
      return bridge.localTracksRemoveAll();
    },
  };
});
