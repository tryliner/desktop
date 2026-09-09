import { useMemo } from "react";
import { useLikedTracks } from "./useLikedTracks";

export function useIsTrackLiked(trackId: string | undefined): boolean {
  const { data } = useLikedTracks();
  return useMemo(() => {
    if (!trackId || !data?.tracks) return false;
    return data.tracks.some((t) => t.id === trackId);
  }, [trackId, data]);
}
