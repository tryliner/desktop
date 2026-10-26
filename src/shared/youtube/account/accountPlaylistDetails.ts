import type { ApiTrack, CatalogPlaylistDetails } from "@/shared/contracts";
import { findFirst } from "@/shared/utils/json";
import { getText } from "../innertube/innertubeJson";
import { videoThumbnailCover } from "../innertube/innertubeThumbnail";
import { parseDurationMs } from "../innertube/innertubeTrackMapper";
import { browseTvTiles } from "./tvBrowse";
import { parsePlaylistAuthor } from "./playlistAuthor";
import { lineBrowseId, lineText, type TvTile } from "./tvTiles";

const MAX_PAGES = 50;
const TOPIC_SUFFIX = / - Topic$/;

function toTrack(tile: TvTile): ApiTrack {
  const artistName = lineText(tile, 0)?.replace(TOPIC_SUFFIX, "");
  const durationMs = tile.overlayText ? parseDurationMs(tile.overlayText) : 0;
  return {
    id: tile.id,
    title: tile.title,
    artists: artistName
      ? [{ id: lineBrowseId(tile, 0) ?? "unknown", name: artistName }]
      : [],
    durationMs: durationMs ?? 0,
    cover: tile.cover ?? videoThumbnailCover(tile.id),
  };
}

function toBrowseId(playlistId: string): string {
  return playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;
}

export async function fetchYoutubeAccountPlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<CatalogPlaylistDetails | null> {
  const { firstPage, tiles } = await browseTvTiles(
    toBrowseId(playlistId),
    "video",
    MAX_PAGES,
    signal,
  );
  const entity = findFirst(firstPage, "entityMetadataRenderer");
  const title = getText(entity?.title);
  if (!title) return null;
  const tracks = tiles.map(toTrack);
  const author = parsePlaylistAuthor(entity);
  return {
    type: "playlist",
    id: playlistId,
    title,
    ...(author ? { author } : {}),
    ...(tracks[0]?.cover ? { cover: tracks[0].cover } : {}),
    trackCount: tracks.length,
    tracks,
  };
}
