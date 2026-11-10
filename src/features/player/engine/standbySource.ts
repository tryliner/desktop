import type { Track } from "@/shared/types";
import { linerDb } from "@/shared/storage";
import { isLocalTrackId } from "@/shared/media/local";
import { isSavedTrack } from "@/shared/media/saved";
import { resolvePlaybackStream } from "./streamResolver";
import { rememberStreamOrigin } from "./nowPlayingLog";

export interface StandbySource {
  url: string;
  blobUrl: string | null;
  release: (() => void) | null;
}

export function releaseStandbySource(source: StandbySource): void {
  if (source.blobUrl) URL.revokeObjectURL(source.blobUrl);
  source.release?.();
}

async function fromStream(
  track: Track,
  saved: boolean,
): Promise<StandbySource | null> {
  const stream = await resolvePlaybackStream(
    track,
    new AbortController().signal,
  );
  if (saved) rememberStreamOrigin(track.id, { ...stream, source: "local" });
  const blobUrl = stream.blob ? URL.createObjectURL(stream.blob) : null;
  const url = blobUrl ?? stream.url;
  if (!url) {
    stream.release?.();
    return null;
  }
  return { url, blobUrl, release: stream.release ?? null };
}

function isPlayableBlob(blob: Blob | undefined): blob is Blob {
  return Boolean(blob?.size && (!blob.type || blob.type.startsWith("audio/")));
}

export async function resolveStandbySource(
  track: Track,
): Promise<StandbySource | null> {
  try {
    if (isSavedTrack(track.id)) return await fromStream(track, true);
    const cached = await linerDb.getAudio(track.id);
    if (isPlayableBlob(cached?.blob)) {
      const blobUrl = URL.createObjectURL(cached.blob);
      return { url: blobUrl, blobUrl, release: null };
    }
    if (isLocalTrackId(track.id)) return await fromStream(track, false);
  } catch {
    return null;
  }
  return null;
}
