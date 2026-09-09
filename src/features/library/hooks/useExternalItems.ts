import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/shared/api";
import type { LibraryItemViewModel } from "../types";

export type EntityType = "album" | "artist" | "playlist";

export function useExternalItems(type: EntityType) {
  const [data, setData] = useState<LibraryItemViewModel[]>([]);
  useEffect(() => {
    if (type === "playlist") { setData([]); return; }
    let active = true;
    const load = async () => {
      try {
        const response = await api.listSavedCollections(type === "album" ? "albums" : "artists");
        if (!active) return;
        setData(response.items.map((entry: any) => {
          const value = entry[type];
          const cover = value.cover ? mediaUrl(value.cover.url) : "";
          return {
            id: value.id,
            title: type === "artist" ? value.name : value.title,
            subtitle: type === "artist" ? "Artist" : [value.year, value.trackCount ? `${value.trackCount} tracks` : undefined].filter(Boolean).join(" • "),
            imageUrl: cover,
            kind: type,
            href: type === "artist" ? `/artist?id=${encodeURIComponent(value.id)}` : `/collection?type=album&id=${encodeURIComponent(value.id)}`,
            addedAt: entry.savedAt,
            trackCount: value.trackCount,
          };
        }));
      } catch { if (active) setData([]); }
    };
    void load(); const refresh = () => void load(); window.addEventListener("library:changed", refresh);
    return () => { active = false; window.removeEventListener("library:changed", refresh); };
  }, [type]);
  return { data };
}
