import { useCallback, useState } from "react";
import type { AccountScope } from "./accountScope";
import {
  StaleSessionError,
  trackIdFrom,
  type MutateOptions,
  type TrackMutationInput,
} from "./mutationQueue";
import { runTrackMutation } from "./runTrackMutation";

export function useTrackMutation<R>(
  apply: (trackId: string, scope: AccountScope) => void,
  call: (trackId: string, signal: AbortSignal) => Promise<R>,
) {
  const [pendingCount, setPendingCount] = useState(0);

  const mutateAsync = useCallback(
    async (input: TrackMutationInput) => {
      setPendingCount((n) => n + 1);
      try {
        return await runTrackMutation(trackIdFrom(input), apply, call);
      } finally {
        setPendingCount((n) => n - 1);
      }
    },
    [apply, call],
  );

  const mutate = useCallback(
    (input: TrackMutationInput, options?: MutateOptions<R>) => {
      void mutateAsync(input)
        .then(
          (value) => options?.onSuccess?.(value),
          (error) => {
            if (!(error instanceof StaleSessionError)) options?.onError?.(error);
          },
        )
        .finally(() => options?.onSettled?.());
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending: pendingCount > 0 };
}
