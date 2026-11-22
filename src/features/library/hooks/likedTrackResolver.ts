import type { Track } from "@/shared/types";
import { equivalentTrack } from "./likedTrackMatching";
import type { LikeTarget } from "./likedTrackMatching";
import {
  getLikedCache,
  optimisticOverrides,
  optimisticTracks,
  syncingLikes,
} from "./likedTrackStore";

function isLikedById(trackId: string): boolean {
  const override = optimisticOverrides.get(trackId);
  if (override !== undefined) return override;
  return getLikedCache().tracks.some((track) => track.id === trackId);
}

export function likedTrackFor(target: Track): Track | undefined {
  const cache = getLikedCache();
  const exactCache = cache.tracks.find((track) => track.id === target.id);
  if (exactCache) return exactCache;
  const cachedMatch = cache.tracks.find((track) =>
    equivalentTrack(target, track),
  );
  if (cachedMatch) return cachedMatch;
  const pending = [...optimisticTracks.entries()].find(
    ([id, track]) =>
      (optimisticOverrides.get(id) === true || syncingLikes.has(id)) &&
      equivalentTrack(target, track),
  );
  return pending ? { ...pending[1], id: pending[0] } : undefined;
}

export function isTrackLikedNow(target: LikeTarget): boolean {
  if (typeof target === "string") return isLikedById(target);
  const match = likedTrackFor(target);
  return match ? isLikedById(match.id) : isLikedById(target.id);
}

export function likeIdFor(target: LikeTarget): string {
  if (typeof target === "string") return target;
  return likedTrackFor(target)?.id ?? target.id;
}
