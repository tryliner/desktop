import { useCallback, useSyncExternalStore } from "react";
import { audioCache } from "@/shared/storage";

const subscribe = (listener: () => void) =>
  audioCache.subscribeCachedIds(listener);

export function useIsTrackCached(trackId: string | undefined): boolean {
  const getSnapshot = useCallback(
    () => (trackId ? audioCache.isCached(trackId) : false),
    [trackId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
