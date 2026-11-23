import { useCallback, useRef, useState } from "react";
import { setTrackLiked, toggleTrackLike } from "./useLikedTracks";
import type { LikeTarget } from "./likedTrackMatching";

type Options = {
  onSuccess?: (value: unknown) => unknown;
  onError?: (error: unknown) => unknown;
  onSettled?: () => unknown;
};

type TrackMutationInput = LikeTarget | { trackId: string; [key: string]: unknown };

function isLikeTarget(input: TrackMutationInput): input is LikeTarget {
  if (typeof input !== "string" && "trackId" in input) return false;
  return (
    typeof input === "string" ||
    ("id" in input && "title" in input && "artists" in input)
  );
}

function useTrackLikeMutation(liked: boolean) {
  const pendingCount = useRef(0);
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = useCallback(
    async (input: TrackMutationInput) => {
      pendingCount.current += 1;
      setIsPending(true);
      try {
        return await setTrackLiked(
          isLikeTarget(input) ? input : input.trackId,
          liked,
        );
      } finally {
        pendingCount.current -= 1;
        setIsPending(pendingCount.current > 0);
      }
    },
    [liked],
  );
  const mutate = useCallback(
    (input: TrackMutationInput, options?: Options) => {
      void (async () => {
        try {
          const value = await mutateAsync(input);
          try {
            await options?.onSuccess?.(value);
          } catch (error) {
            void error;
          }
        } catch (error) {
          try {
            await options?.onError?.(error);
          } catch (callbackError) {
            void callbackError;
          }
        }
        try {
          await options?.onSettled?.();
        } catch (callbackError) {
          void callbackError;
        }
      })();
    },
    [mutateAsync],
  );
  return { mutate, mutateAsync, isPending };
}

export function useLikeTrack() {
  return useTrackLikeMutation(true);
}

export function useUnlikeTrack() {
  return useTrackLikeMutation(false);
}

export function useToggleTrackLike() {
  return useCallback(
    (
      target: LikeTarget,
      options?: {
        onSuccess?: (liked: boolean) => unknown;
        onError?: (error: unknown) => unknown;
      },
    ): boolean => {
      const { liked, settled } = toggleTrackLike(target);
      void (async () => {
        try {
          await settled;
          try {
            await options?.onSuccess?.(liked);
          } catch (error) {
            void error;
          }
        } catch (error) {
          try {
            await options?.onError?.(error);
          } catch (callbackError) {
            void callbackError;
          }
        }
      })();
      return liked;
    },
    [],
  );
}
