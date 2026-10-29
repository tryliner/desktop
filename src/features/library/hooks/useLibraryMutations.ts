import { useCallback, useState } from "react";
import { api } from "@/shared/api";
import { evictPlaylistFromCache } from "./usePlaylists";
import { notifyLibraryChanged } from "./usePlaylists.ts";
import type { MutateOptions } from "./likes/mutationQueue";

function useMutation<T, R = unknown>(action: (input: T) => Promise<R>) {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(
    async (input: T): Promise<R> => {
      setIsPending(true);
      try {
        const result = await action(input);
        notifyLibraryChanged();
        return result;
      } finally {
        setIsPending(false);
      }
    },
    [action],
  );
  const mutate = useCallback(
    (input: T, options?: MutateOptions<R>) => {
      void mutateAsync(input)
        .then((value) => options?.onSuccess?.(value))
        .catch((error) => options?.onError?.(error))
        .finally(() => options?.onSettled?.());
    },
    [mutateAsync],
  );
  return { mutate, mutateAsync, isPending };
}

export function useAddPlaylistTracks() {
  return useMutation(
    ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
      api.addPlaylistTrack(playlistId, trackId),
  );
}

export function useRemovePlaylistTracks() {
  return useMutation(
    ({ playlistId, itemId }: { playlistId: string; itemId: string }) =>
      api.removePlaylistItem(playlistId, itemId),
  );
}

export function useReorderPlaylistTracks() {
  return useMutation(
    ({
      playlistId,
      itemId,
      beforeItemId,
      revision,
    }: {
      playlistId: string;
      itemId: string;
      beforeItemId: string | null;
      revision: number;
    }) => api.movePlaylistItem(playlistId, itemId, beforeItemId, revision),
  );
}

export function useCreatePlaylist() {
  return useMutation(
    ({ title, description }: { title: string; description?: string }) =>
      api.createPlaylist({ title, description }),
  );
}

export function useDeletePlaylist() {
  return useMutation(async ({ playlistId }: { playlistId: string }) => {
    evictPlaylistFromCache(playlistId);
    return api.deletePlaylist(playlistId);
  });
}

export function useSaveExternalItem() {
  return useMutation(
    ({
      type,
      id,
      snapshot,
    }: {
      type: "album" | "artist" | "playlist";
      id: string;
      snapshot?: Record<string, unknown>;
    }) =>
      api.saveCollection(
        `${type}s` as "albums" | "artists" | "playlists",
        id,
        snapshot,
      ),
  );
}

export function useRemoveExternalItem() {
  return useMutation(
    async ({
      type,
      id,
      isOwned,
    }: {
      type: "album" | "artist" | "playlist";
      id: string;
      isOwned?: boolean;
    }) => {
      if (type === "playlist") {
        evictPlaylistFromCache(id);
        if (isOwned === false) {
          return api.removeCollection("playlists", id);
        }
        try {
          const res = await api.deletePlaylist(id);
          // purge any saved collection reference in case it was both created and saved
          await api.removeCollection("playlists", id).catch(() => {});
          return res;
        } catch (err: unknown) {
          if (isOwned === true) {
            throw err;
          }
          // fall back to removing from saved collections if playlist was not owned
          return api.removeCollection("playlists", id);
        }
      }
      return api.removeCollection(`${type}s` as "albums" | "artists", id);
    },
  );
}
