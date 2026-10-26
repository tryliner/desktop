import { useEffect, useMemo, useState } from "react";
import {
  fetchYoutubeAccountPlaylists,
  getYoutubeAuthTokens,
  isAlbumPlaylistId,
  onYoutubeAuthChanged,
  useYoutubePreferences,
  type YoutubeAccountPlaylist,
} from "@/shared/youtube";
import type { LibraryItemViewModel } from "../types";

interface LoadedPlaylists {
  session: string;
  playlists: YoutubeAccountPlaylist[];
}

const YOUTUBE_ORDER_ORIGIN = Date.UTC(2000, 0, 1);

let cached: LoadedPlaylists | null = null;

const currentSession = () => getYoutubeAuthTokens()?.refreshToken ?? null;

function toLibraryItem(
  playlist: YoutubeAccountPlaylist,
  index: number,
): LibraryItemViewModel {
  const kind = isAlbumPlaylistId(playlist.id) ? "album" : "playlist";
  return {
    id: playlist.id,
    title: playlist.title,
    subtitle: playlist.subtitle ?? "YouTube Music",
    imageUrl: playlist.thumbnailUrl ?? "",
    kind,
    href: `/collection?type=${kind}&id=${encodeURIComponent(playlist.id)}`,
    addedAt: new Date(YOUTUBE_ORDER_ORIGIN - index).toISOString(),
    isOwned: false,
    source: "youtube",
  };
}

export function useYoutubeLibraryItems(): LibraryItemViewModel[] {
  const syncLibrary = useYoutubePreferences((state) => state.syncLibrary);
  const [session, setSession] = useState(currentSession);
  const [loaded, setLoaded] = useState<LoadedPlaylists | null>(cached);

  useEffect(() => onYoutubeAuthChanged(() => setSession(currentSession())), []);

  useEffect(() => {
    if (!session || !syncLibrary || cached?.session === session) return;
    const controller = new AbortController();
    fetchYoutubeAccountPlaylists(controller.signal)
      .then((playlists) => {
        if (controller.signal.aborted) return;
        cached = { session, playlists };
        setLoaded(cached);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [session, syncLibrary]);

  return useMemo(() => {
    if (!syncLibrary || !session || loaded?.session !== session) return [];
    return loaded.playlists.map(toLibraryItem);
  }, [loaded, session, syncLibrary]);
}
