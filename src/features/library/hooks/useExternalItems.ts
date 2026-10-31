import { useEffect } from "react";
import { api, mediaUrl, toMaxQualityAvatarUrl } from "@/shared/api";
import {
  freshFor,
  revalidateResource,
  useCachedResource,
} from "@/shared/cache/useCachedResource";
import { useSessionOwner } from "@/features/home/hooks/sessionAwareLoad";
import type { LibraryItemViewModel } from "../types";

export type EntityType = "album" | "artist" | "playlist";

const EMPTY_ITEMS: LibraryItemViewModel[] = [];
const SAVED_ITEMS_POLICY = { isFresh: freshFor(5 * 60_000) };

function hrefOf(type: EntityType, id: string): string {
  const encoded = encodeURIComponent(id);
  return type === "artist"
    ? `/artist?id=${encoded}`
    : `/collection?type=${type}&id=${encoded}`;
}

// rows saved before snapshots were required hold only the id: they still
// open, with the id as their title and no cover
async function loadSavedItems(
  type: EntityType,
): Promise<LibraryItemViewModel[]> {
  if (type === "artist") {
    const response = await api.listSavedCollections("artists");
    return response.items.map((entry) => {
      const cover = entry.snapshot?.cover;
      return {
        id: entry.id,
        title: entry.snapshot?.name ?? entry.id,
        subtitle: "Artist",
        imageUrl: cover ? toMaxQualityAvatarUrl(mediaUrl(cover.url)) : "",
        kind: type,
        href: hrefOf(type, entry.id),
        addedAt: entry.savedAt,
        isOwned: false,
      };
    });
  }
  const response = await api.listSavedCollections(
    type === "album" ? "albums" : "playlists",
  );
  return response.items.map((entry) => {
    const snapshot = entry.snapshot;
    const tracks = snapshot?.trackCount
      ? `${snapshot.trackCount} tracks`
      : undefined;
    return {
      id: entry.id,
      title: snapshot?.title ?? entry.id,
      subtitle:
        type === "playlist"
          ? snapshot?.author || tracks || "Playlist"
          : [snapshot?.author, tracks].filter(Boolean).join(" • "),
      imageUrl: snapshot?.cover ? mediaUrl(snapshot.cover.url) : "",
      kind: type,
      href: hrefOf(type, entry.id),
      addedAt: entry.savedAt,
      trackCount: snapshot?.trackCount,
      isOwned: false,
    };
  });
}

export function useExternalItems(type: EntityType) {
  const owner = useSessionOwner();
  const key = `library:saved:${type}:${owner}`;
  const { data, isLoading } = useCachedResource(
    key,
    () => loadSavedItems(type),
    SAVED_ITEMS_POLICY,
  );

  useEffect(() => {
    const refresh = () =>
      void revalidateResource(key, () => loadSavedItems(type), { force: true });
    window.addEventListener("library:changed", refresh);
    return () => window.removeEventListener("library:changed", refresh);
  }, [key, type]);

  return { data: data ?? EMPTY_ITEMS, isLoading };
}
