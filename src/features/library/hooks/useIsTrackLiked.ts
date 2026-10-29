import { useLikedTracks } from "./useLikedTracks";

const idSets = new WeakMap<object, Set<string>>();

function likedIdsOf(tracks: { id: string }[]): Set<string> {
  let set = idSets.get(tracks);
  if (!set) {
    set = new Set(tracks.map((t) => t.id));
    idSets.set(tracks, set);
  }
  return set;
}

export function useIsTrackLiked(trackId: string | undefined): boolean {
  const { data } = useLikedTracks();
  if (!trackId || !data?.tracks) return false;
  return likedIdsOf(data.tracks).has(trackId);
}
