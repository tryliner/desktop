import { isYoutubeSignedIn } from "../auth/youtubeAuthSession";
import { browseTvTiles } from "./tvBrowse";
import { lineText, type TvTile } from "./tvTiles";

const PLAYLISTS_BROWSE_ID = "FEmusic_liked_playlists";
const MAX_PAGES = 20;

const accountPlaylistIds = new Set(["LM"]);

export function isAccountPlaylistId(playlistId: string): boolean {
  return accountPlaylistIds.has(playlistId.replace(/^VL/, ""));
}

export interface YoutubeAccountPlaylist {
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
}

function toPlaylist(tile: TvTile): YoutubeAccountPlaylist {
  const subtitle = lineText(tile, 0);
  return {
    id: tile.id,
    title: tile.title,
    ...(subtitle ? { subtitle } : {}),
    ...(tile.cover ? { thumbnailUrl: tile.cover.url } : {}),
  };
}

export async function fetchYoutubeAccountPlaylists(
  signal?: AbortSignal,
): Promise<YoutubeAccountPlaylist[]> {
  if (!isYoutubeSignedIn()) return [];
  const { tiles } = await browseTvTiles(
    PLAYLISTS_BROWSE_ID,
    "playlist",
    MAX_PAGES,
    signal,
  );
  const playlists = tiles.map(toPlaylist);
  for (const playlist of playlists) accountPlaylistIds.add(playlist.id);
  return playlists;
}
