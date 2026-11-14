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
  /** false when the track is already in the playlist or can't be saved */
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
      const current = get().links[playlistId] ?? [];
      const next = current.filter((e) => e.fileId !== fileId);
      const links = { ...get().links };
      if (next.length > 0) links[playlistId] = next;
      else delete links[playlistId];
      set({ links });
      await bridge.localPlaylistLinksRemove(playlistId, fileId);
    },

    removePlaylist: async (playlistId) => {
      const bridge = window.linerElectron;
      if (!bridge) return;
      const links = { ...get().links };
      delete links[playlistId];
      set({ links });
      await bridge.localPlaylistLinksRemovePlaylist(playlistId);
    },
  }),
);
