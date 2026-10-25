import type { Track, TrackArtist, TrackDetails } from "@/shared/contracts";
import { asArray, asRecord, type JsonRecord } from "@/shared/utils/json";
import { getRuns, getText, runsToAlbum, runsToArtists } from "./innertubeJson";
import { coverFromThumbnail } from "./innertubeThumbnail";
import { hasExplicitBadge, parseDurationMs } from "./innertubeTrackMapper";

function panelRenderer(raw: unknown): JsonRecord | undefined {
  return asRecord(asRecord(raw)?.playlistPanelVideoRenderer);
}

function bylineOf(renderer: JsonRecord): JsonRecord | undefined {
  return (
    asRecord(renderer.longBylineText) ??
    asRecord(renderer.shortBylineText) ??
    asRecord(renderer.bylineText)
  );
}

export function getQueueItems(response: unknown): unknown[] {
  const contents = asRecord(asRecord(response)?.contents);
  const singleColumn = asRecord(
    contents?.singleColumnMusicWatchNextResultsRenderer,
  );
  const watchNext = asRecord(
    asRecord(singleColumn?.tabbedRenderer)?.watchNextTabbedResultsRenderer,
  );
  for (const tab of asArray(watchNext?.tabs)) {
    const queue = asRecord(
      asRecord(asRecord(asRecord(tab)?.tabRenderer)?.content)
        ?.musicQueueRenderer,
    );
    const panel = asArray(
      asRecord(asRecord(queue?.content)?.playlistPanelRenderer)?.contents,
    );
    if (panel.length > 0) return panel;
  }
  const direct = asArray(
    asRecord(singleColumn?.playlistPanelRenderer)?.contents,
  );
  if (direct.length > 0) return direct;
  const twoColumn = asRecord(contents?.twoColumnWatchNextResults);
  return asArray(asRecord(asRecord(twoColumn?.playlist)?.playlist)?.contents);
}

export function getTrackItem(
  response: unknown,
  videoId: string,
): unknown | undefined {
  const items = getQueueItems(response);
  return (
    items.find((item) => panelRenderer(item)?.selected === true) ??
    items.find((item) => panelRenderer(item)?.videoId === videoId)
  );
}

function plainArtist(
  runs: JsonRecord[],
  byline: JsonRecord | undefined,
): TrackArtist {
  const run = runs.find((candidate) => {
    const text =
      typeof candidate.text === "string" ? candidate.text.trim() : "";
    return Boolean(text) && text !== "•" && !/^\d{4}$/.test(text);
  });
  if (typeof run?.text === "string")
    return { id: "unknown", name: run.text.trim() };
  return { id: "unknown", name: getText(byline) ?? "Unknown Artist" };
}

export function mapInnertubeRadioTrack(raw: unknown): Track | null {
  const renderer = panelRenderer(raw) ?? asRecord(raw);
  if (!renderer) return null;
  const id = renderer.videoId;
  const title = getText(renderer.title);
  if (typeof id !== "string" || !title) return null;

  const byline = bylineOf(renderer);
  const runs = getRuns(byline);
  let artists = runsToArtists(runs);
  if (artists.length === 0) {
    const bylineText = getText(byline);
    artists = [
      {
        id: "",
        name: bylineText
          ? bylineText.split("•")[0]?.trim() || bylineText
          : "Unknown Artist",
      },
    ];
  }
  const durationText =
    getText(renderer.lengthText) ?? getText(renderer.duration) ?? "";

  return {
    id,
    title,
    artists,
    album: runsToAlbum(runs),
    durationMs: parseDurationMs(durationText) ?? 0,
    cover: coverFromThumbnail(renderer.thumbnail),
    explicit: hasExplicitBadge(renderer),
  };
}

export function mapInnertubeTrackDetails(raw: unknown): TrackDetails | null {
  const renderer = panelRenderer(raw);
  if (!renderer) return null;
  const id = renderer.videoId;
  const title = getText(renderer.title);
  if (typeof id !== "string" || !title) return null;

  const byline = bylineOf(renderer);
  const runs = getRuns(byline);
  const artists = runsToArtists(
    runs,
    (type) => type === "MUSIC_PAGE_TYPE_ARTIST",
  );
  const channels = runsToArtists(
    runs,
    (type) => type === "MUSIC_PAGE_TYPE_USER_CHANNEL",
  );
  const credited =
    artists.length > 0
      ? artists
      : channels.length > 0
        ? channels
        : [plainArtist(runs, byline)];
  const releaseDate = runs
    .map((run) => run.text)
    .find(
      (text): text is string =>
        typeof text === "string" && /^\d{4}$/.test(text),
    );

  return {
    id,
    title,
    artists: credited,
    album: runsToAlbum(runs),
    durationMs: parseDurationMs(getText(renderer.lengthText) ?? "") ?? 0,
    cover: coverFromThumbnail(renderer.thumbnail),
    releaseDate,
    explicit: hasExplicitBadge(renderer),
  };
}
