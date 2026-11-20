import { create } from "zustand";
import { api, ApiError, mediaUrl } from "@/shared/api";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type PlaylistCoverErrorReason =
  "too-large" | "unsupported-type" | "unavailable" | "failed";

export class PlaylistCoverError extends Error {
  constructor(readonly reason: PlaylistCoverErrorReason) {
    super(reason);
  }
}

function toCoverError(error: unknown): PlaylistCoverError {
  if (error instanceof PlaylistCoverError) return error;
  if (error instanceof ApiError) {
    if (error.status === 413) return new PlaylistCoverError("too-large");
    if (error.status === 415) return new PlaylistCoverError("unsupported-type");
    if (error.status === 404 || error.status === 405 || error.status === 501) {
      return new PlaylistCoverError("unavailable");
    }
  }
  return new PlaylistCoverError("failed");
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function notifyLibrary() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("library:changed"));
  }
}

interface PlaylistCoversState {
  overrides: Record<string, string | null>;
  setCover: (playlistId: string, image: Blob) => Promise<string>;
  removeCover: (playlistId: string) => Promise<void>;
  reset: () => void;
}

export const usePlaylistCoversStore = create<PlaylistCoversState>(
  (set, get) => ({
    overrides: {},

    setCover: async (playlistId, image) => {
      if (image.size > MAX_UPLOAD_BYTES) {
        throw new PlaylistCoverError("too-large");
      }
      try {
        const playlist = await api.setPlaylistCover(playlistId, {
          image: await blobToBase64(image),
          contentType: image.type,
        });
        const url = playlist.coverUrl ? mediaUrl(playlist.coverUrl) : "";
        if (!url) throw new PlaylistCoverError("unavailable");
        set((state) => ({
          overrides: { ...state.overrides, [playlistId]: url },
        }));
        notifyLibrary();
        return url;
      } catch (error) {
        throw toCoverError(error);
      }
    },

    removeCover: async (playlistId) => {
      const had = playlistId in get().overrides;
      const previous = get().overrides[playlistId];
      set((state) => ({
        overrides: { ...state.overrides, [playlistId]: null },
      }));
      try {
        await api.removePlaylistCover(playlistId);
        notifyLibrary();
      } catch (error) {
        set((state) => {
          const overrides = { ...state.overrides };
          if (had) overrides[playlistId] = previous ?? null;
          else delete overrides[playlistId];
          return { overrides };
        });
        throw toCoverError(error);
      }
    },

    reset: () => set({ overrides: {} }),
  }),
);

if (typeof window !== "undefined") {
  window.addEventListener("auth:changed", () =>
    usePlaylistCoversStore.getState().reset(),
  );
}

export function usePlaylistCoverOverrides(): Record<string, string | null> {
  return usePlaylistCoversStore((state) => state.overrides);
}
