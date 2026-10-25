import {
  asArray,
  asRecord,
  collectByKey,
  stringValue,
  type JsonRecord,
} from "@/shared/utils/json";
import type { Cover } from "@/shared/contracts";
import { getRuns, getText } from "../innertube/innertubeJson";
import { coverFromThumbnail } from "../innertube/innertubeThumbnail";

export type TvTileKind = "playlist" | "video";

export interface TvTile {
  kind: TvTileKind;
  id: string;
  title: string;
  lines: JsonRecord[];
  cover?: Cover;
  overlayText?: string;
}

const CONTENT_KINDS: Record<string, TvTileKind> = {
  TILE_CONTENT_TYPE_PLAYLIST: "playlist",
  TILE_CONTENT_TYPE_VIDEO: "video",
};

function playlistBrowseId(tile: JsonRecord | undefined): string | undefined {
  const endpoint = asRecord(asRecord(tile?.onSelectCommand)?.browseEndpoint);
  return stringValue(endpoint?.browseId)?.replace(/^VL/, "");
}

function overlayText(header: JsonRecord | undefined): string | undefined {
  const overlay = collectByKey(
    header?.thumbnailOverlays,
    "thumbnailOverlayTimeStatusRenderer",
  )[0];
  return getText(asRecord(overlay)?.text);
}

function tileLines(metadata: JsonRecord | undefined): JsonRecord[] {
  return asArray(metadata?.lines).flatMap((line) =>
    asArray(asRecord(asRecord(line)?.lineRenderer)?.items).flatMap((item) => {
      const text = asRecord(asRecord(asRecord(item)?.lineItemRenderer)?.text);
      return text ? [text] : [];
    }),
  );
}

function menuSubtitle(tile: JsonRecord | undefined): JsonRecord[] {
  const subtitle = asRecord(
    asRecord(asRecord(tile?.onLongPressCommand)?.showMenuCommand)?.subtitle,
  );
  return subtitle ? [subtitle] : [];
}

function mapTile(raw: unknown): TvTile | null {
  const tile = asRecord(raw);
  const kind = CONTENT_KINDS[stringValue(tile?.contentType) ?? ""];
  const id =
    (kind === "playlist" ? playlistBrowseId(tile) : undefined) ??
    stringValue(tile?.contentId);
  const metadata = asRecord(asRecord(tile?.metadata)?.tileMetadataRenderer);
  const header = asRecord(asRecord(tile?.header)?.tileHeaderRenderer);
  const trackHeader = asRecord(asRecord(tile?.header)?.trackTileHeaderRenderer);
  const title = getText(metadata?.title) ?? getText(trackHeader?.title);
  if (!kind || !id || !title) return null;
  const cover = coverFromThumbnail((header ?? trackHeader)?.thumbnail);
  const overlay = overlayText(header) ?? getText(trackHeader?.duration);
  return {
    kind,
    id,
    title,
    lines: metadata ? tileLines(metadata) : menuSubtitle(tile),
    ...(cover ? { cover } : {}),
    ...(overlay ? { overlayText: overlay } : {}),
  };
}

export function parseTvTiles(body: unknown, kind: TvTileKind): TvTile[] {
  return collectByKey(body, "tileRenderer")
    .map(mapTile)
    .filter((tile): tile is TvTile => tile?.kind === kind);
}

export function lineText(tile: TvTile, index: number): string | undefined {
  return getText(tile.lines[index]);
}

export function lineBrowseId(tile: TvTile, index: number): string | undefined {
  const run = getRuns(tile.lines[index])[0];
  const endpoint = asRecord(asRecord(run?.navigationEndpoint)?.browseEndpoint);
  return stringValue(endpoint?.browseId);
}
