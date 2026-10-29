import { api } from "@/shared/api";
import { applyOptimisticLike } from "./optimisticLikes";
import { useTrackMutation } from "./useTrackMutation";

const likeTrack = (trackId: string, signal: AbortSignal) =>
  api.likeTrack(trackId, { signal });

export function useLikeTrack() {
  return useTrackMutation(applyOptimisticLike, likeTrack);
}
