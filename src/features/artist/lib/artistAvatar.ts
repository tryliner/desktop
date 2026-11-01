import { api, mediaUrl } from "@/shared/api";
import type { TrackArtist } from "@/shared/types";

const artistAvatarCache = new Map<string, string | null>();
const pendingArtistAvatars = new Map<string, Promise<string | null>>();

export function primaryArtistId(
  artistId?: string,
  artistList?: TrackArtist[],
): string | undefined {
  const id = artistId || artistList?.[0]?.id;
  return id && id !== "unknown" ? id : undefined;
}

export function cachedArtistAvatar(
  artistId: string,
): string | null | undefined {
  return artistAvatarCache.get(artistId);
}

export function loadArtistAvatar(artistId: string): Promise<string | null> {
  const pending = pendingArtistAvatars.get(artistId);
  if (pending) return pending;
  const request = api
    .getArtistImage(artistId)
    .then((url) => (url ? mediaUrl(url) || null : null))
    .catch(() => null)
    .then((url) => {
      artistAvatarCache.set(artistId, url);
      pendingArtistAvatars.delete(artistId);
      return url;
    });
  pendingArtistAvatars.set(artistId, request);
  return request;
}

const GOOGLE_IMAGE_HOST = /[a-zA-Z0-9_-]+\.(?:googleusercontent|ggpht)\.com/i;
const GOOGLE_SIZE_SUFFIX = /=(?:w\d+-h\d+|s\d+)(?:-[a-zA-Z0-9_-]+)*$/;

export function sizedAvatarUrl(url: string, size: number): string {
  if (!GOOGLE_IMAGE_HOST.test(url)) return url;
  const suffix = `=s${size}-c`;
  return GOOGLE_SIZE_SUFFIX.test(url)
    ? url.replace(GOOGLE_SIZE_SUFFIX, suffix)
    : `${url}${suffix}`;
}
