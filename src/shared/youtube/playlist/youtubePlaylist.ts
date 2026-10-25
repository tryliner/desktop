import { postInnertube } from "../innertube/innertubeClient";
import {
  extractInnertubeContinuationToken,
  fetchInnertubeContinuation,
} from "./youtubeContinuation";
import {
  parseYoutubePlaylistHeader,
  type YoutubePlaylistHeader,
} from "./youtubeHeader";
import {
  parseInnertubeTracks,
  type YoutubePlaylistTrack,
} from "./youtubePlaylistTracks";

const MAX_CONTINUATION_PAGES = 50;

export interface YoutubePlaylist extends YoutubePlaylistHeader {
  tracks: YoutubePlaylistTrack[];
}

async function collectContinuations(
  initialBody: unknown,
  seenIds: Set<string>,
  tracks: YoutubePlaylistTrack[],
  signal?: AbortSignal,
): Promise<void> {
  let token = extractInnertubeContinuationToken(initialBody);
  let pageCount = 0;
  while (token && pageCount < MAX_CONTINUATION_PAGES) {
    pageCount += 1;
    const body = await fetchInnertubeContinuation(token, signal);
    if (!body) break;
    const previousCount = tracks.length;
    parseInnertubeTracks(body, seenIds, tracks);
    const nextToken = extractInnertubeContinuationToken(body);
    if (!nextToken || nextToken === token || tracks.length === previousCount)
      break;
    token = nextToken;
  }
}

export async function fetchYoutubePlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<YoutubePlaylist> {
  const body = await postInnertube(
    "browse",
    { browseId: playlistId },
    { signal },
  );
  const header = parseYoutubePlaylistHeader(body);
  const tracks: YoutubePlaylistTrack[] = [];
  const seenIds = new Set<string>();
  parseInnertubeTracks(body, seenIds, tracks);
  await collectContinuations(body, seenIds, tracks, signal);
  return { ...header, tracks };
}
