import { useEffect, useState } from "react";
import { api, mediaUrl, toMaxQualityAvatarUrl } from "@/shared/api";
import type { LibraryItemViewModel } from "../types";

export type EntityType = "album" | "artist" | "playlist";

const cache = new Map<EntityType, LibraryItemViewModel[]>();

export function useExternalItems(type: EntityType) {
  const [data, setData] = useState<LibraryItemViewModel[]>(() => cache.get(type) ?? []);
  const [isLoading, setIsLoading] = useState(() => !cache.has(type));
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const collectionType =
          type === "album" ? "albums" : type === "artist" ? "artists" : "playlists";
        const response = await api.listSavedCollections(collectionType);
        if (!active) return;
        const items: LibraryItemViewModel[] = response.items.map((entry: any) => {
          const value = entry[type];
          const rawCover = value.cover ? mediaUrl(value.cover.url) : "";
          const cover = type === "artist" ? toMaxQualityAvatarUrl(rawCover) : rawCover;
          return {
            id: value.id,
            title: type === "artist" ? value.name : value.title,
            subtitle:
              type === "artist"
                ? "Artist"
                : type === "playlist"
                  ? (value.author || (value.trackCount ? `${value.trackCount} tracks` : "Playlist"))
                  : [value.year, value.trackCount ? `${value.trackCount} tracks` : undefined].filter(Boolean).join(" • "),
            imageUrl: cover,
            kind: type,
            href:
              type === "artist"
                ? `/artist?id=${encodeURIComponent(value.id)}`
                : type === "playlist"
                  ? `/collection?type=playlist&id=${encodeURIComponent(value.id)}`
                  : `/collection?type=album&id=${encodeURIComponent(value.id)}`,
            addedAt: entry.savedAt,
            trackCount: value.trackCount,
            isOwned: false,
          };
        });
        cache.set(type, items);
        setData(items);
      } catch {
        if (active && !cache.has(type)) setData([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    const refresh = () => void load();
    const resetForAccount = () => {
      cache.delete(type);
      setData([]);
      void load();
    };
    window.addEventListener("library:changed", refresh);
    window.addEventListener("auth:changed", resetForAccount);
    return () => {
      active = false;
      window.removeEventListener("library:changed", refresh);
      window.removeEventListener("auth:changed", resetForAccount);
    };
  }, [type]);
  return { data, isLoading };
}
