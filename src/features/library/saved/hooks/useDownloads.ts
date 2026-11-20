import { useMemo } from "react";
import { isSavedTrack } from "@/shared/media/saved";
import { isLocalTrackId } from "@/shared/media/local";
import { useSavedTracksStore } from "../store/savedTracksStore";
import {
  currentDownloads,
  useDownloadsStore,
  type PinnedTrack,
} from "../store/downloadsStore";

export type TrackDownloadState =
  "downloaded" | "downloading" | "queued" | "failed" | null;

export function canDownloadHere(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.linerElectron?.savedTracksSave)
  );
}

export function useTrackDownloadState(trackId: string | undefined): {
  state: TrackDownloadState;
  progress: number | null;
  pinned: boolean;
  pinnedDirectly: boolean;
} {
  useSavedTracksStore((s) => s.records);
  const active = useDownloadsStore((s) =>
    s.active?.trackId === trackId ? s.active : null,
  );
  const queued = useDownloadsStore((s) =>
    trackId ? s.queued.includes(trackId) : false,
  );
  const failed = useDownloadsStore((s) =>
    trackId ? s.failed.includes(trackId) : false,
  );
  const pinnedDirectly = useDownloadsStore((s) =>
    trackId ? Boolean(currentDownloads(s).tracks[trackId]) : false,
  );
  const pinned = useDownloadsStore((s) => {
    if (!trackId) return false;
    const downloads = currentDownloads(s);
    if (downloads.tracks[trackId]) return true;
    return Object.values(downloads.collections).some((collection) =>
      collection.tracks.some((track) => track.id === trackId),
    );
  });
  if (!trackId || isLocalTrackId(trackId)) {
    return {
      state: null,
      progress: null,
      pinned: false,
      pinnedDirectly: false,
    };
  }
  if (isSavedTrack(trackId))
    return { state: "downloaded", progress: 1, pinned, pinnedDirectly };
  if (active) {
    return {
      state: "downloading",
      progress: active.total ? active.received / active.total : null,
      pinned,
      pinnedDirectly,
    };
  }
  if (queued)
    return { state: "queued", progress: null, pinned, pinnedDirectly };
  if (failed)
    return { state: "failed", progress: null, pinned, pinnedDirectly };
  return { state: null, progress: null, pinned, pinnedDirectly };
}

export function useCollectionDownload(
  id: string | null | undefined,
  tracks: Pick<PinnedTrack, "id">[],
) {
  const records = useSavedTracksStore((s) => s.records);
  const pinned = useDownloadsStore((s) =>
    id ? Boolean(currentDownloads(s).collections[id]) : false,
  );
  const activeId = useDownloadsStore((s) => s.active?.trackId ?? null);
  return useMemo(() => {
    const cloud = tracks.filter((track) => !isLocalTrackId(track.id));
    const saved = new Set(records.map((record) => record.trackId));
    const downloaded = cloud.filter((track) => saved.has(track.id)).length;
    return {
      pinned,
      total: cloud.length,
      downloaded,
      complete: cloud.length > 0 && downloaded === cloud.length,
      busy:
        pinned &&
        downloaded < cloud.length &&
        Boolean(activeId && cloud.some((track) => track.id === activeId)),
    };
  }, [records, tracks, pinned, activeId]);
}

export {
  downloadTracks,
  removeTrackDownloads,
  downloadCollection,
  removeCollectionDownload,
  formatDownloadBytes,
} from "./downloadActions";
