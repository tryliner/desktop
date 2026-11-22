import { useMemo } from "react";
import { isTrackLikedNow, useLikedTracks } from "./useLikedTracks";
import type { Track } from "@/shared/types";

export function useIsTrackLiked(track: Track | null | undefined): boolean {
  useLikedTracks();
  return useMemo(() => {
    return track ? isTrackLikedNow(track) : false;
  }, [track]);
}
