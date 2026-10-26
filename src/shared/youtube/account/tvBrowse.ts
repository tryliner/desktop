import { postInnertube } from "../innertube/innertubeClient";
import { TV_ACCOUNT_PROFILE } from "../innertube/playbackProfiles";
import { extractInnertubeContinuationToken } from "../playlist/youtubeContinuation";
import { parseTvTiles, type TvTile, type TvTileKind } from "./tvTiles";

export interface TvBrowsePage {
  firstPage: unknown;
  tiles: TvTile[];
}

function browseTv(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return postInnertube("browse", body, {
    profile: TV_ACCOUNT_PROFILE,
    signal,
  });
}

export async function browseTvTiles(
  browseId: string,
  kind: TvTileKind,
  maxPages: number,
  signal?: AbortSignal,
): Promise<TvBrowsePage> {
  const firstPage = await browseTv({ browseId }, signal);
  const tiles = new Map<string, TvTile>();
  let page = firstPage;
  for (let index = 0; index < maxPages; index += 1) {
    const before = tiles.size;
    for (const tile of parseTvTiles(page, kind)) {
      if (!tiles.has(tile.id)) tiles.set(tile.id, tile);
    }
    const token = extractInnertubeContinuationToken(page);
    if (!token || (index > 0 && tiles.size === before)) break;
    page = await browseTv({ continuation: token }, signal);
  }
  return { firstPage, tiles: [...tiles.values()] };
}
