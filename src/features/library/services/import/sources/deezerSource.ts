import {
  asArray,
  asRecord,
  type JsonRecord,
  numberValue,
  stringValue,
} from "@/shared/utils/json";
import type {
  ClientImportedPlaylist,
  ClientImportedTrack,
} from "../importTypes";
import { tryFetchJson } from "@/shared/api/tryFetch";
import { requireOk } from "../shared/http";

const DEEZER_API = "https://api.deezer.com";

function mapDeezerTrack(rawItem: unknown): ClientImportedTrack | undefined {
  const item = asRecord(rawItem);
  if (!item) return undefined;
  const title = item.title;
  const artist = asRecord(item.artist)?.name;
  if (typeof title !== "string" || typeof artist !== "string") return undefined;
  const album = asRecord(item.album);
  const cover = stringValue(album?.cover_big) ?? stringValue(album?.cover);
  const duration = numberValue(item.duration);
  return {
    sourceId: String(item.id ?? ""),
    title,
    artists: [artist],
    album: stringValue(album?.title),
    durationMs: duration !== undefined ? duration * 1000 : undefined,
    ...(cover ? { coverUrl: cover } : {}),
  };
}

function appendTracks(tracks: ClientImportedTrack[], data: unknown[]): void {
  for (const item of data) {
    const track = mapDeezerTrack(item);
    if (track) tracks.push(track);
  }
}

async function followNextPages(
  firstNext: string | undefined,
  tracks: ClientImportedTrack[],
  signal?: AbortSignal,
): Promise<number> {
  let nextUrl = firstNext;
  let pageCount = 0;
  while (nextUrl && pageCount < 50) {
    pageCount += 1;
    const body = asRecord(await tryFetchJson(nextUrl, { signal }));
    const data = asArray(body?.data);
    if (!body || !data.length) break;
    appendTracks(tracks, data);
    nextUrl = stringValue(body.next);
  }
  return pageCount;
}

async function fillRemainingTracks(
  id: string,
  body: JsonRecord | undefined,
  tracks: ClientImportedTrack[],
  startPage: number,
  signal?: AbortSignal,
): Promise<void> {
  const totalTracks = numberValue(body?.nb_tracks);
  let pageCount = startPage;
  while (totalTracks && tracks.length < totalTracks && pageCount < 60) {
    pageCount += 1;
    const url = `${DEEZER_API}/playlist/${id}/tracks?limit=100&index=${tracks.length}`;
    const data = asArray(asRecord(await tryFetchJson(url, { signal }))?.data);
    if (!data.length) break;
    const previousLength = tracks.length;
    appendTracks(tracks, data);
    if (tracks.length === previousLength) break;
  }
}

export async function importDeezer(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<ClientImportedPlaylist> {
  const id = new URL(rawUrl).pathname.split("/").filter(Boolean).at(-1);
  if (!id || !/^\d+$/.test(id))
    throw new Error("Deezer playlist URL is invalid.");
  const response = await fetch(`${DEEZER_API}/playlist/${id}`, { signal });
  requireOk(response, "Deezer");
  const body = asRecord((await response.json()) as unknown);
  const tracks: ClientImportedTrack[] = [];
  const trackPage = asRecord(body?.tracks);
  appendTracks(tracks, asArray(trackPage?.data));

  const pageCount = await followNextPages(
    stringValue(trackPage?.next),
    tracks,
    signal,
  );
  await fillRemainingTracks(id, body, tracks, pageCount, signal);

  return {
    source: "deezer",
    sourceUrl: rawUrl,
    title: stringValue(body?.title) ?? "Imported Deezer playlist",
    description: stringValue(body?.description),
    tracks,
  };
}
