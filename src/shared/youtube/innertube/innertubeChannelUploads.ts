import type { Track, TrackArtist } from "@/shared/contracts";
import {
  asRecord,
  findFirst,
  trimmedString,
  walkRecords,
} from "@/shared/utils/json";
import { postInnertube, WEB_PROFILE } from "./innertubeClient";
import { videoThumbnailCover } from "./innertubeThumbnail";
import { parseDurationMs } from "./innertubeTrackMapper";

const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_LOCKUP = "LOCKUP_CONTENT_TYPE_VIDEO";

export function channelIdOfArtist(
  artistId: string,
  body: unknown,
): string | undefined {
  const subscribe = findFirst(body, "subscribeButtonRenderer");
  const linked = trimmedString(subscribe?.channelId);
  if (linked && CHANNEL_ID.test(linked)) return linked;
  return CHANNEL_ID.test(artistId) ? artistId : undefined;
}

function lockupDurationMs(lockup: Record<string, unknown>): number {
  let durationMs = 0;
  walkRecords(lockup.contentImage, (record) => {
    const badge = asRecord(record.thumbnailBadgeViewModel);
    const text = trimmedString(badge?.text);
    const parsed = text ? parseDurationMs(text) : undefined;
    if (parsed === undefined) return false;
    durationMs = parsed;
    return true;
  });
  return durationMs;
}

export function mapChannelUploads(body: unknown, artist: TrackArtist): Track[] {
  const tracks: Track[] = [];
  const seen = new Set<string>();
  walkRecords(body, (record) => {
    const lockup = asRecord(record.lockupViewModel);
    if (!lockup) return false;
    const id = trimmedString(lockup.contentId);
    const metadata = asRecord(
      asRecord(lockup.metadata)?.lockupMetadataViewModel,
    );
    const title = trimmedString(asRecord(metadata?.title)?.content);
    if (lockup.contentType !== VIDEO_LOCKUP || !id || !title || seen.has(id))
      return true;
    seen.add(id);
    tracks.push({
      id,
      title,
      artists: [artist],
      durationMs: lockupDurationMs(lockup),
      cover: videoThumbnailCover(id),
    });
    return true;
  });
  return tracks;
}

export async function fetchChannelUploads(
  channelId: string,
  artist: TrackArtist,
  signal?: AbortSignal,
): Promise<Track[]> {
  const body = await postInnertube(
    "browse",
    { browseId: `VLUU${channelId.slice(2)}` },
    { profile: WEB_PROFILE, signal },
  );
  return mapChannelUploads(body, artist);
}
