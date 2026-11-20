import { isLocalTrackId } from "@/shared/media/local";
import { isSavedTrack } from "@/shared/media/saved";
import { showToast } from "@/shared/ui";
import type { TFunction } from "@/languages";
import { isTrackLikedNow } from "../../hooks/useLikedTracks";
import { useSavedTracksStore } from "../store/savedTracksStore";
import {
  estimateBytes,
  useDownloadsStore,
  type CollectionKind,
  type PinnedTrack,
} from "../store/downloadsStore";

export function formatDownloadBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

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
            size: formatDownloadBytes(bytes),
            limit: formatDownloadBytes(limitBytes),
          })
        : [
            t("downloads.estimate", {
              count: missing.length,
              size: formatDownloadBytes(bytes),
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
