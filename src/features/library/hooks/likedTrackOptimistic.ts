import {
  bumpOptimisticOverrideVersion,
  emitLikedTracks,
  optimisticOverrideVersions,
  optimisticOverrideWriters,
  optimisticOverrides,
} from "./likedTrackStore";

const overrideOwners = new Map<string, symbol>();
const baseOverrides = new Map<string, boolean | undefined>();
const operationVersions = new Map<string, number>();

export function applyOptimisticLike(trackId: string): () => void {
  if (
    !overrideOwners.has(trackId) ||
    optimisticOverrideWriters.get(trackId) === "setter"
  ) {
    baseOverrides.set(trackId, optimisticOverrides.get(trackId));
  }
  const owner = Symbol(trackId);
  overrideOwners.set(trackId, owner);
  optimisticOverrides.set(trackId, true);
  operationVersions.set(trackId, bumpOptimisticOverrideVersion(trackId, owner));
  emitLikedTracks(false);
  return () => {
    if (overrideOwners.get(trackId) !== owner) return;
    if (
      optimisticOverrideVersions.get(trackId) !== operationVersions.get(trackId)
    )
      return;
    if (optimisticOverrideWriters.get(trackId) !== owner) return;
    overrideOwners.delete(trackId);
    operationVersions.delete(trackId);
    const base = baseOverrides.get(trackId);
    if (base === undefined) optimisticOverrides.delete(trackId);
    else optimisticOverrides.set(trackId, base);
    baseOverrides.delete(trackId);
    bumpOptimisticOverrideVersion(trackId);
    emitLikedTracks(false);
  };
}

export function applyOptimisticUnlike(trackId: string): () => void {
  if (
    !overrideOwners.has(trackId) ||
    optimisticOverrideWriters.get(trackId) === "setter"
  ) {
    baseOverrides.set(trackId, optimisticOverrides.get(trackId));
  }
  const owner = Symbol(trackId);
  overrideOwners.set(trackId, owner);
  optimisticOverrides.set(trackId, false);
  operationVersions.set(trackId, bumpOptimisticOverrideVersion(trackId, owner));
  emitLikedTracks(false);
  return () => {
    if (overrideOwners.get(trackId) !== owner) return;
    if (
      optimisticOverrideVersions.get(trackId) !== operationVersions.get(trackId)
    )
      return;
    if (optimisticOverrideWriters.get(trackId) !== owner) return;
    overrideOwners.delete(trackId);
    operationVersions.delete(trackId);
    const base = baseOverrides.get(trackId);
    if (base === undefined) optimisticOverrides.delete(trackId);
    else optimisticOverrides.set(trackId, base);
    baseOverrides.delete(trackId);
    bumpOptimisticOverrideVersion(trackId);
    emitLikedTracks(false);
  };
}
