import type { SearchResult } from "@/shared/contracts";
import { asArray, asRecord, type JsonRecord } from "@/shared/utils/json";
import {
  getPageType,
  getRuns,
  getText,
  runsToAlbum,
  runsToArtists,
  yearFromRuns,
} from "./innertubeJson";
import { coverFromThumbnail } from "./innertubeThumbnail";
import {
  durationFromRuns,
  hasExplicitBadge,
  parseDurationMs,
} from "./innertubeTrackMapper";

function endpointFrom(
  card: JsonRecord,
  titleRun: JsonRecord | undefined,
  kind: string,
  idKey: string,
): JsonRecord | undefined {
  const candidates = [
    card.onTap,
    titleRun?.navigationEndpoint,
    card.navigationEndpoint,
  ];
  const overlay = asRecord(
    asRecord(asRecord(card.thumbnailOverlay)?.musicItemThumbnailOverlayRenderer)
      ?.content,
  );
  candidates.push(
    asRecord(overlay?.musicPlayButtonRenderer)?.playNavigationEndpoint,
  );
  for (const button of asArray(card.buttons)) {
    const renderer = asRecord(asRecord(button)?.buttonRenderer);
    candidates.push(renderer?.command, renderer?.navigationEndpoint);
  }
  for (const candidate of candidates) {
    const endpoint = asRecord(asRecord(candidate)?.[kind]);
    if (typeof endpoint?.[idKey] === "string") return endpoint;
  }
  return undefined;
}

function plainSubtitleArtist(
  runs: JsonRecord[],
): { id: string; name: string }[] {
  const candidate = runs.find((run) => {
    const text = typeof run.text === "string" ? run.text.trim() : "";
    if (!text || text === "•") return false;
    if (["video", "song", "episode"].includes(text.toLowerCase())) return false;
    if (/views|plays|monthly/i.test(text)) return false;
    return parseDurationMs(text) === undefined;
  });
  return typeof candidate?.text === "string"
    ? [{ id: "unknown", name: candidate.text.trim() }]
    : [];
}

export function mapCardShelf(raw: unknown): SearchResult | null {
  const record = asRecord(raw);
  const card =
    asRecord(record?.musicCardShelfRenderer) ??
    (record?.title && (record.onTap || record.buttons) ? record : undefined);
  if (!card) return null;

  const titleRun = getRuns(card.title)[0];
  const title = getText(card.title);
  if (!title) return null;

  const browse = endpointFrom(card, titleRun, "browseEndpoint", "browseId");
  const watch = endpointFrom(card, titleRun, "watchEndpoint", "videoId");
  const pageType = getPageType(browse);
  const browseId =
    typeof browse?.browseId === "string" ? browse.browseId : undefined;
  const subtitleRuns = getRuns(card.subtitle);
  const isArtist = pageType === "MUSIC_PAGE_TYPE_ARTIST";
  const cover = coverFromThumbnail(card.thumbnail, { isArtist });
  const coverPart = cover ? { cover } : {};

  if (isArtist && browseId)
    return { type: "artist", id: browseId, name: title, ...coverPart };

  if (pageType === "MUSIC_PAGE_TYPE_ALBUM" && browseId) {
    const artists = runsToArtists(
      subtitleRuns,
      (type) => type === "MUSIC_PAGE_TYPE_ARTIST",
    );
    return {
      type: "album",
      id: browseId,
      title,
      artists,
      year: yearFromRuns(card.subtitle),
      ...coverPart,
    };
  }

  if (pageType === "MUSIC_PAGE_TYPE_PLAYLIST" && browseId) {
    const author = subtitleRuns
      .map((run) => (typeof run.text === "string" ? run.text.trim() : ""))
      .find(Boolean);
    return { type: "playlist", id: browseId, title, author, ...coverPart };
  }

  if (typeof watch?.videoId === "string") {
    const linked = runsToArtists(subtitleRuns);
    const artists =
      linked.length > 0 ? linked : plainSubtitleArtist(subtitleRuns);
    return {
      type: "track",
      id: watch.videoId,
      title,
      artists: artists.length > 0 ? artists : [{ id: "", name: "Unknown" }],
      album: runsToAlbum(subtitleRuns),
      durationMs: durationFromRuns(subtitleRuns),
      ...coverPart,
      explicit: hasExplicitBadge(card),
    };
  }

  return null;
}
