import { isTrackLikedNow, useLikedTracks } from "./useLikedTracks";
import type { Track } from "@/shared/types";

export function useIsTrackLiked(
  track: string | Track | null | undefined,
): boolean {
  useLikedTracks();
  return track ? isTrackLikedNow(track) : false;
}
