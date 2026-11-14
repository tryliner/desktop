import { create } from "zustand";
import {
  localFileId,
  type LocalPlaylistEntry,
  type LocalPlaylistLinks,
} from "@/shared/media/local";
import type { Track } from "@/shared/types";

interface LocalPlaylistLinksState {
  links: LocalPlaylistLinks;
  loaded: boolean;
  load: () => Promise<void>;
  add: (playlistId: string, track: Track) => Promise<boolean>;
  remove: (playlistId: string, trackId: string) => Promise<void>;
  removePlaylist: (playlistId: string) => Promise<void>;
}

export const useLocalPlaylistLinksStore = create<LocalPlaylistLinksState>(
  (set, get) => ({
    links: {},
    loaded: false,

    load: async () => {
      const bridge = window.linerElectron;
      if (!bridge) {
        set({ loaded: true });
        return;
      }
      try {
        set({ links: await bridge.localPlaylistLinksList(), loaded: true });
      } catch {
        set({ loaded: true });
      }
    },

    add: async (playlistId, track) => {
      const bridge = window.linerElectron;
      if (!bridge) return false;
      const entry: LocalPlaylistEntry = {
        fileId: localFileId(track.id),
        title: track.title,
        artist: track.artists,
        durationMs: track.durationMs ?? 0,
        addedAt: Date.now(),
      };
      const added = await bridge.localPlaylistLinksAdd(playlistId, entry);
      if (added) {
        const current = get().links[playlistId] ?? [];
        set({ links: { ...get().links, [playlistId]: [...current, entry] } });
      }
      return added;
    },

    remove: async (playlistId, trackId) => {
      const bridge = window.linerElectron;
      if (!bridge) return;
      const fileId = localFileId(trackId);
      await bridge.localPlaylistLinksRemove(playlistId, fileId);
      const latest = get().links;
      const next = (latest[playlistId] ?? []).filter(
        (e) => e.fileId !== fileId,
      );
      const links = { ...latest };
      if (next.length > 0) links[playlistId] = next;
      else delete links[playlistId];
      set({ links });
    },

    removePlaylist: async (playlistId) => {
      const bridge = window.linerElectron;
      if (!bridge) return;
      await bridge.localPlaylistLinksRemovePlaylist(playlistId);
      const links = { ...get().links };
      delete links[playlistId];
      set({ links });
    },
  }),
);
