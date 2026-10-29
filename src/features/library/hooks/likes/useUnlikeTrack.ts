import { api } from "@/shared/api";
import { applyOptimisticUnlike } from "./optimisticLikes";
import { useTrackMutation } from "./useTrackMutation";

const unlikeTrack = (trackId: string, signal: AbortSignal) =>
  api.unlikeTrack(trackId, { signal });

export function useUnlikeTrack() {
  return useTrackMutation(applyOptimisticUnlike, unlikeTrack);
}
