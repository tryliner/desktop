import {
  asRecord,
  type JsonRecord,
  numberValue,
  stringValue,
} from "@/shared/utils/json";
import { soundCloudCover } from "@/shared/media/soundcloud";
import type { ClientImportedTrack } from "../../importTypes";
import { withoutArtistPrefix } from "../../shared/titles";

/**
 * Many SoundCloud uploads (reupload channels especially) leave `artwork_url`
 * null on every track; soundcloud.com then shows the set's artwork or the
 * uploader's avatar instead. Mirror that so imported tracks aren't coverless.
 */
function soundCloudTrackCoverUrl(
  item: JsonRecord,
  user: JsonRecord | undefined,
  fallbackArtworkUrl?: string,
): string | undefined {
  return (
    soundCloudCover(item.artwork_url)?.url ??
    soundCloudCover(fallbackArtworkUrl)?.url ??
    soundCloudCover(user?.avatar_url)?.url
  );
}

export function mapSoundCloudTrack(
  item: JsonRecord,
  fallbackArtworkUrl?: string,
): ClientImportedTrack | undefined {
  const publisher = asRecord(item.publisher_metadata);
  const user = asRecord(item.user);
  const publisherArtist = stringValue(publisher?.artist);
  const artist = publisherArtist?.trim()
    ? publisherArtist.trim()
    : user?.username;
  const title =
    typeof item.title === "string"
      ? withoutArtistPrefix(item.title, publisherArtist)
      : undefined;
  if (typeof title !== "string" || typeof artist !== "string") return undefined;

  const artwork = soundCloudTrackCoverUrl(item, user, fallbackArtworkUrl);
  const artistId =
    typeof user?.id === "number" ? `sc_user_${user.id}` : undefined;
  return {
    sourceId: String(item.id ?? ""),
    title,
    artists: [artist],
    artistIds: [artistId],
    album: stringValue(publisher?.release_title),
    durationMs: numberValue(item.duration),
    ...(artwork ? { coverUrl: artwork } : {}),
  };
}

export function soundCloudCanonicalId(sourceId: string): string {
  return sourceId.startsWith("sc:") ? sourceId : `sc:${sourceId}`;
}
