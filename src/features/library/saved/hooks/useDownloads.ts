import { useMemo } from "react";
import { isSavedTrack } from "@/shared/media/saved";
import { isLocalTrackId } from "@/shared/media/local";
import { showToast } from "@/shared/ui";
import type { TFunction } from "@/languages";
import { isTrackLikedNow } from "../../hooks/useLikedTracks";
import { useSavedTracksStore } from "../store/savedTracksStore";
import {
  currentDownloads,
  estimateBytes,
  useDownloadsStore,
  type CollectionKind,
  type PinnedTrack,
} from "../store/downloadsStore";

export type TrackDownloadState =
  "downloaded" | "downloading" | "queued" | "failed" | null;

/** downloads need the desktop app: the web build has nowhere to keep files */
export function canDownloadHere(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.linerElectron?.savedTracksSave)
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

/** what a song row shows: saved, being fetched (with progress), waiting, failed */
export function useTrackDownloadState(trackId: string | undefined): {
  state: TrackDownloadState;
  progress: number | null;
  pinned: boolean;
} {
  // records changing is what flips a row to "downloaded"
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
  const pinned = useDownloadsStore((s) => {
    if (!trackId) return false;
    const downloads = currentDownloads(s);
    if (downloads.tracks[trackId]) return true;
    return Object.values(downloads.collections).some((collection) =>
      collection.tracks.some((track) => track.id === trackId),
    );
  });
  if (!trackId || isLocalTrackId(trackId)) {
    return { state: null, progress: null, pinned: false };
  }
  if (isSavedTrack(trackId))
    return { state: "downloaded", progress: 1, pinned };
  if (active) {
    return {
      state: "downloading",
      progress: active.total ? active.received / active.total : null,
      pinned,
    };
  }
  if (queued) return { state: "queued", progress: null, pinned };
  if (failed) return { state: "failed", progress: null, pinned };
  return { state: null, progress: null, pinned };
}

/** a playlist or album's download toggle: pinned? how far along? */
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

/** one or more songs in, with a size hint and a warning past the limit */
export function downloadTracks(tracks: PinnedTrack[], t: TFunction) {
  const cloud = tracks.filter((track) => !isLocalTrackId(track.id));
  if (cloud.length === 0) return;
  useDownloadsStore.getState().pinTracks(cloud);
  reportQueued(cloud, t);
}

export function removeTrackDownloads(trackIds: string[], t: TFunction) {
  useDownloadsStore.getState().unpinTracks(trackIds);
  const stillLiked = trackIds.filter(
    (id) => isTrackLikedNow(id) && useSavedTracksStore.getState().enabled,
  );
  showToast(
    t("downloads.removed", { count: trackIds.length }),
    "checkmark",
    stillLiked.length > 0
      ? { description: t("downloads.kept_because_liked") }
      : undefined,
  );
}

export function downloadCollection(
  collection: {
    id: string;
    kind: CollectionKind;
    title: string;
    coverUrl: string;
    tracks: PinnedTrack[];
  },
  t: TFunction,
) {
  useDownloadsStore.getState().pinCollection(collection);
  reportQueued(collection.tracks, t, collection.title);
}

export function removeCollectionDownload(
  id: string,
  title: string,
  t: TFunction,
) {
  useDownloadsStore.getState().unpinCollection(id);
  showToast(t("downloads.collection_removed"), "checkmark", {
    description: title,
  });
}

function reportQueued(tracks: PinnedTrack[], t: TFunction, title?: string) {
  const saved = tracks.filter((track) => isSavedTrack(track.id));
  const missing = tracks.filter(
    (track) => !isSavedTrack(track.id) && !isLocalTrackId(track.id),
  );
  if (missing.length === 0) {
    showToast(t("downloads.already_downloaded"), "checkmark", {
      description: title,
    });
    return;
  }
  const bytes = estimateBytes(missing);
  const { limitBytes } = useSavedTracksStore.getState();
  const used = useSavedTracksStore
    .getState()
    .records.reduce((sum, record) => sum + record.byteSize, 0);
  const overLimit = limitBytes > 0 && used + bytes > limitBytes;
  showToast(
    title
      ? t("downloads.collection_queued", { name: title })
      : t("downloads.queued", { count: missing.length }),
    overLimit ? "info" : "checkmark",
    {
      description: overLimit
        ? t("downloads.over_limit", {
            size: formatBytes(bytes),
            limit: formatBytes(limitBytes),
          })
        : [
            t("downloads.estimate", {
              count: missing.length,
              size: formatBytes(bytes),
            }),
            saved.length > 0
              ? t("downloads.some_ready", { count: saved.length })
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
    },
  );
}

export { formatBytes as formatDownloadBytes };
