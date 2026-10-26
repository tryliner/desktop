import {
  asArray,
  asRecord,
  type JsonRecord,
  recordAt,
  stringValue,
} from "@/shared/utils/json";
import type {
  ClientImportedPlaylist,
  ClientImportedTrack,
} from "../../importTypes";
import { tryFetchJson } from "@/shared/api/tryFetch";
import { getAppleMusicWebToken } from "./appleMusicToken";
import {
  appendAppleMusicTracks,
  appleMusicPlaylistMeta,
} from "./appleMusicTracks";
import { parseAppleMusicUrl } from "./appleMusicUrl";

const APPLE_MUSIC_API = "https://api.music.apple.com";

async function fetchCatalogResource(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<{ resource: JsonRecord; token: string }> {
  const { storefront, type, id } = parseAppleMusicUrl(rawUrl);
  let token = await getAppleMusicWebToken(false, signal);
  const request = (url: string) =>
    fetch(url, { headers: { authorization: `Bearer ${token}` }, signal });
  const endpointFor = (store: string) =>
    `${APPLE_MUSIC_API}/v1/catalog/${store}/${type}s/${encodeURIComponent(id)}`;

  let response = await request(endpointFor(storefront));
  if (response.status === 401) {
    token = await getAppleMusicWebToken(true, signal);
    response = await request(endpointFor(storefront));
  }
  if (response.status === 404 && storefront !== "us") {
    const retry = await request(endpointFor("us"));
    if (retry.ok) response = retry;
  }
  if (!response.ok)
    throw new Error(`Apple Music API request failed (${response.status}).`);

  const resource = asRecord(
    asArray(asRecord((await response.json()) as unknown)?.data)[0],
  );
  if (!resource) throw new Error("Apple Music item was not found.");
  return { resource, token };
}

async function followTrackPages(
  firstNext: string | undefined,
  token: string,
  tracks: ClientImportedTrack[],
  signal?: AbortSignal,
): Promise<void> {
  let nextUrl = firstNext;
  let pageCount = 0;
  while (nextUrl && pageCount < 50) {
    pageCount += 1;
    const fullUrl = nextUrl.startsWith("http")
      ? nextUrl
      : `${APPLE_MUSIC_API}${nextUrl}`;
    const body = asRecord(
      await tryFetchJson(fullUrl, {
        headers: { authorization: `Bearer ${token}` },
        signal,
      }),
    );
    const data = asArray(body?.data);
    if (!data.length) break;
    const previousLength = tracks.length;
    appendAppleMusicTracks(tracks, data);
    if (tracks.length === previousLength) break;
    nextUrl = stringValue(body?.next);
  }
}

export async function importAppleMusic(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<ClientImportedPlaylist> {
  const { resource, token } = await fetchCatalogResource(rawUrl, signal);
  const tracks: ClientImportedTrack[] = [];
  const initialTracks = recordAt(resource, "relationships", "tracks");
  appendAppleMusicTracks(tracks, asArray(initialTracks?.data));
  await followTrackPages(
    stringValue(initialTracks?.next),
    token,
    tracks,
    signal,
  );

  if (tracks.length === 0)
    throw new Error("No tracks found in the Apple Music playlist.");
  return {
    source: "apple_music",
    sourceUrl: rawUrl,
    ...appleMusicPlaylistMeta(resource),
    tracks,
  };
}
