import { useCallback, useState } from "react";
import { api } from "@/shared/api";
import { notifyLibraryChanged } from "./usePlaylists";
import { applyOptimisticLike, applyOptimisticUnlike } from "./useLikedTracks";

type Options = {
  onSuccess?: (...args: any[]) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

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
    [action]
  );
  const mutate = useCallback(
    (input: T, options?: Options) => {
      void mutateAsync(input)
        .then((value) => options?.onSuccess?.(value))
        .catch((error) => options?.onError?.(error))
        .finally(() => options?.onSettled?.());
    },
    [mutateAsync]
  );
  return { mutate, mutateAsync, isPending };
}

export function useAddPlaylistTracks() {
  return useMutation(({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
    api.addPlaylistTrack(playlistId, trackId)
  );
}

export function useRemovePlaylistTracks() {
  return useMutation(({ playlistId, itemId }: { playlistId: string; itemId: string }) =>
    api.removePlaylistItem(playlistId, itemId)
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
    }) => api.movePlaylistItem(playlistId, itemId, beforeItemId, revision)
  );
}

export function useCreatePlaylist() {
  return useMutation(({ title, description }: { title: string; description?: string }) =>
    api.createPlaylist({ title, description })
  );
}

export function useDeletePlaylist() {
  return useMutation(({ playlistId }: { playlistId: string }) =>
    api.deletePlaylist(playlistId)
  );
}

export function useSaveExternalItem() {
  return useMutation(({ type, id }: { type: "album" | "artist" | "playlist"; id: string }) =>
    api.saveCollection(`${type}s` as "albums" | "artists" | "playlists", id)
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
        if (isOwned) {
          return api.deletePlaylist(id);
        }
        try {
          return await api.removeCollection("playlists", id);
        } catch {
          return api.deletePlaylist(id);
        }
      }
      return api.removeCollection(`${type}s` as "albums" | "artists", id);
    },
  );
}

type TrackMutationInput = string | { trackId: string; [key: string]: unknown };
const trackIdFrom = (input: TrackMutationInput) =>
  typeof input === "string" ? input : input.trackId;

export function useLikeTrack() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (input: TrackMutationInput) => {
    const trackId = trackIdFrom(input);
    setIsPending(true);
    const rollback = applyOptimisticLike(trackId);
    try {
      const result = await api.likeTrack(trackId);
      notifyLibraryChanged();
      return result;
    } catch (err) {
      rollback();
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  const mutate = useCallback(
    (input: TrackMutationInput, options?: Options) => {
      void mutateAsync(input)
        .then((value) => options?.onSuccess?.(value))
        .catch((error) => options?.onError?.(error))
        .finally(() => options?.onSettled?.());
    },
    [mutateAsync]
  );

  return { mutate, mutateAsync, isPending };
}

export function useUnlikeTrack() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (input: TrackMutationInput) => {
    const trackId = trackIdFrom(input);
    setIsPending(true);
    const rollback = applyOptimisticUnlike(trackId);
    try {
      const result = await api.unlikeTrack(trackId);
      notifyLibraryChanged();
      return result;
    } catch (err) {
      rollback();
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  const mutate = useCallback(
    (input: TrackMutationInput, options?: Options) => {
      void mutateAsync(input)
        .then((value) => options?.onSuccess?.(value))
        .catch((error) => options?.onError?.(error))
        .finally(() => options?.onSettled?.());
    },
    [mutateAsync]
  );

  return { mutate, mutateAsync, isPending };
}
