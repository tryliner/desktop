import type { ApiTrack, CatalogPlaylistDetails } from "@/shared/contracts";
import { findFirst } from "@/shared/utils/json";
import { getText } from "../innertube/innertubeJson";
import { videoThumbnailCover } from "../innertube/innertubeThumbnail";
import { parseDurationMs } from "../innertube/innertubeTrackMapper";
import { browseTvTiles } from "./tvBrowse";
import { parsePlaylistAuthor } from "./playlistAuthor";
import { publishPlaylistProgress } from "./playlistProgress";
import { lineBrowseId, lineText, type TvTile } from "./tvTiles";

const MAX_PAGES = 500;
const PROGRESS_INTERVAL_MS = 750;
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

interface PlaylistHeader {
  title: string;
  author?: string;
}

function readHeader(firstPage: unknown): PlaylistHeader | null {
  const entity = findFirst(firstPage, "entityMetadataRenderer");
  const title = getText(entity?.title);
  if (!title) return null;
  const author = parsePlaylistAuthor(entity);
  return { title, ...(author ? { author } : {}) };
}

function buildPlaylist(
  playlistId: string,
  header: PlaylistHeader,
  tiles: TvTile[],
): CatalogPlaylistDetails {
  const tracks = tiles.map(toTrack);
  return {
    type: "playlist",
    id: playlistId,
    title: header.title,
    ...(header.author ? { author: header.author } : {}),
    ...(tracks[0]?.cover ? { cover: tracks[0].cover } : {}),
    trackCount: tracks.length,
    tracks,
  };
}

export async function fetchYoutubeAccountPlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<CatalogPlaylistDetails | null> {
  let header: PlaylistHeader | null | undefined;
  let lastPublished = 0;
  const { firstPage, tiles } = await browseTvTiles(
    toBrowseId(playlistId),
    "video",
    MAX_PAGES,
    signal,
    (partial) => {
      const now = Date.now();
      if (lastPublished && now - lastPublished < PROGRESS_INTERVAL_MS) return;
      header ??= readHeader(partial.firstPage);
      if (!header) return;
      lastPublished = now;
      publishPlaylistProgress(
        playlistId,
        buildPlaylist(playlistId, header, partial.tiles),
      );
    },
  );
  const finalHeader = header ?? readHeader(firstPage);
  return finalHeader ? buildPlaylist(playlistId, finalHeader, tiles) : null;
}
