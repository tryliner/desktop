import { useCallback, useEffect, useState } from "react";
import { useConnectivityStore } from "@/features/connectivity/store/connectivityStore";
import { audioCache } from "@/shared/storage/audioCache";

export interface OfflinePlaybackState {
  isOffline: boolean;
  cachedTrackIds: Set<string>;
  isCached: (trackId: string) => Promise<boolean>;
}

export function useOfflinePlayback(): OfflinePlaybackState {
  const tripped = useConnectivityStore((s) => s.tripped);
  const [cachedTrackIds, setCachedTrackIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // When offline status changes, we could refresh cached track list
    // For now just keep the set updated as tracks get cached
  }, [tripped]);

  const isCached = useCallback(async (trackId: string): Promise<boolean> => {
    const has = await audioCache.hasAudio(trackId);
    if (has) {
      setCachedTrackIds((prev) => {
        if (prev.has(trackId)) return prev;
        const next = new Set(prev);
        next.add(trackId);
        return next;
      });
    }
    return has;
  }, []);

  return {
    isOffline: tripped,
    cachedTrackIds,
    isCached,
  };
}
