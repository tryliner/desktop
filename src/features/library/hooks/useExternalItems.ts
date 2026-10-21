import { useEffect, useState } from "react";
import { api, mediaUrl, toMaxQualityAvatarUrl } from "@/shared/api";
import { runWorkerPool } from "@/shared/utils/workerPool";
import type { LibraryItemViewModel } from "../types";

export type EntityType = "album" | "artist" | "playlist";

type SavedCollectionSummary = {
  id: string;
  title?: string;
  name?: string;
  author?: string;
  year?: number;
  trackCount?: number;
  cover?: { url: string };
};

type SavedCollectionEntry = {
  savedAt: string;
  album?: SavedCollectionSummary;
  artist?: SavedCollectionSummary;
  playlist?: SavedCollectionSummary;
};

/** Maps a saved collection entry and optional catalog details to its library row. */
function toViewModel(
  type: EntityType,
  entry: SavedCollectionEntry,
  value: SavedCollectionSummary,
  details?: SavedCollectionSummary,
): LibraryItemViewModel {
  const title =
    type === "artist"
      ? details?.name || value.name
      : details?.title || value.title;
  const cover = details?.cover?.url ? details.cover : value.cover;
  const year = details?.year ?? value.year;
  const trackCount = details?.trackCount ?? value.trackCount;
  const rawCover = cover?.url ? mediaUrl(cover.url) : "";

  return {
    id: value.id,
    title: title || "",
    subtitle:
      type === "artist"
        ? "Artist"
        : type === "playlist"
          ? (value.author || (trackCount ? `${trackCount} tracks` : "Playlist"))
          : [year, trackCount ? `${trackCount} tracks` : undefined]
              .filter(Boolean)
              .join(" • "),
    imageUrl: type === "artist" ? toMaxQualityAvatarUrl(rawCover) : rawCover,
    kind: type,
    href:
      type === "artist"
        ? `/artist?id=${encodeURIComponent(value.id)}`
        : type === "playlist"
          ? `/collection?type=playlist&id=${encodeURIComponent(value.id)}`
          : `/collection?type=album&id=${encodeURIComponent(value.id)}`,
    addedAt: entry.savedAt,
    trackCount,
    isOwned: false,
  };
}

/** Loads saved collections and retains resolved details while their items stay saved. */
export function useExternalItems(type: EntityType) {
  const [data, setData] = useState<LibraryItemViewModel[]>([]);
  useEffect(() => {
    let active = true;
    let loadSequence = 0;
    const hydratedDetails = new Map<string, SavedCollectionSummary>();
    const load = async () => {
      const sequence = ++loadSequence;
      try {
        const collectionType =
          type === "album" ? "albums" : type === "artist" ? "artists" : "playlists";
        const response = await api.listSavedCollections(collectionType);
        if (!active || sequence !== loadSequence) return;
        const entries = (response.items as SavedCollectionEntry[]).flatMap((entry) => {
          const value = entry[type];
          return value?.id ? [{ entry, value }] : [];
        });

        const currentIds = new Set(entries.map(({ value }) => value.id));
        for (const id of hydratedDetails.keys()) {
          if (!currentIds.has(id)) hydratedDetails.delete(id);
        }

        setData(entries.map(({ entry, value }) => {
          const summaryHasTitleAndCover =
            (type === "artist" ? value.name : value.title) && value.cover?.url;
          const details = summaryHasTitleAndCover ? undefined : hydratedDetails.get(value.id);
          return toViewModel(type, entry, value, details);
        }));
        void runWorkerPool(entries, 4, async ({ entry, value }, index) => {
          const title = type === "artist" ? value.name : value.title;
          const cachedDetails = hydratedDetails.get(value.id);
          const cachedTitle = type === "artist" ? cachedDetails?.name : cachedDetails?.title;
          if (
            !active ||
            sequence !== loadSequence ||
            type === "playlist" ||
            (title && value.cover?.url) ||
            (cachedTitle && cachedDetails?.cover?.url)
          ) {
            return;
          }

          try {
            const details =
              type === "album"
                ? await api.getAlbum(value.id)
                : await api.getArtist(value.id);
            if (!details || !active || sequence !== loadSequence) return;

            hydratedDetails.set(value.id, details);
            const hydratedItem = toViewModel(type, entry, value, details);
            setData((current) => {
              if (!active || sequence !== loadSequence || !current[index]) return current;
              return current.map((item, itemIndex) =>
                itemIndex === index ? hydratedItem : item,
              );
            });
          } catch {
            // Keep the saved summary when catalog details are unavailable.
          }
        });
      } catch {
        if (active && sequence === loadSequence) setData([]);
      }
    };
    void load();
    const refresh = () => void load();
    const refreshAfterAuthChange = () => {
      hydratedDetails.clear();
      void load();
    };
    window.addEventListener("library:changed", refresh);
    window.addEventListener("auth:changed", refreshAfterAuthChange);
    return () => {
      active = false;
      window.removeEventListener("library:changed", refresh);
      window.removeEventListener("auth:changed", refreshAfterAuthChange);
    };
  }, [type]);
  return { data };
}
