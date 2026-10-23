import { useCallback, useEffect, useState } from "react";
import { useDownloadStore, type DownloadStatus } from "../store/downloadStore";
import { audioCache } from "@/shared/storage/audioCache";

export interface UseDownloadTrackResult {
  download: () => void;
  status: DownloadStatus;
  progress: number;
  isCached: boolean;
}

export function useDownloadTrack(trackId: string): UseDownloadTrackResult {
  const item = useDownloadStore((s) => s.downloads.get(trackId));
  const queueDownload = useDownloadStore((s) => s.queueDownload);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    let cancelled = false;
    audioCache.hasAudio(trackId).then((has) => {
      if (!cancelled) setIsCached(has);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId, item?.status]);

  const download = useCallback(() => {
    if (isCached) return;
    queueDownload(trackId);
  }, [trackId, isCached, queueDownload]);

  return {
    download,
    status: item?.status ?? "idle",
    progress: item?.progress ?? 0,
    isCached,
  };
}
