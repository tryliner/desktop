import { useEffect, useState } from "react";
import { api, mediaUrl, toMaxQualityAvatarUrl } from "@/shared/api";
import type { LibraryItemViewModel } from "../types";

export type EntityType = "album" | "artist" | "playlist";

export function useExternalItems(type: EntityType) {
  const [data, setData] = useState<LibraryItemViewModel[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const collectionType =
          type === "album" ? "albums" : type === "artist" ? "artists" : "playlists";
        const response = await api.listSavedCollections(collectionType);
        if (!active) return;
        setData(response.items.map((entry: any) => {
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
        }));
      } catch { if (active) setData([]); }
    };
    void load(); const refresh = () => void load(); window.addEventListener("library:changed", refresh);
    return () => { active = false; window.removeEventListener("library:changed", refresh); };
  }, [type]);
  return { data };
}
