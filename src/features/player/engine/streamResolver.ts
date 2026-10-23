import { resolveDirectAudioStream, toVideoId } from "@/shared/media/innertube";
import { resolveSoundCloudStream, toSoundCloudTrackId } from "@/shared/media/soundcloud";
import { resolveLinerStream } from "@/shared/media/liner/linerPlayback";
import { audioCache } from "@/shared/storage/audioCache";
import { isAbortError } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";
import {
  fromInnertubeStream,
  fromLinerStream,
  fromSoundCloudStream,
  type PlayableTrack,
  type PlaybackStream,
} from "./playbackStream";
import { findYoutubeStandIn } from "./youtubeStandIn";

export type { BufferedPlaybackStream, PlayableTrack, PlaybackStream, UrlPlaybackStream } from "./playbackStream";

async function resolveYoutubeStandIn(track: PlayableTrack, signal?: AbortSignal): Promise<PlaybackStream> {
  const videoId = await findYoutubeStandIn(track, signal);
  if (!videoId) throw new Error("No matching YouTube track found");
  log("cyan", "playback", `playing youtube stand-in ${videoId} for "${track.title}"`);
  return fromInnertubeStream(await resolveDirectAudioStream(videoId, { signal }));
}

async function resolveSoundCloud(track: PlayableTrack, signal?: AbortSignal): Promise<PlaybackStream> {
  try {
    return fromSoundCloudStream(await resolveSoundCloudStream(track.id, { signal }));
  } catch (soundCloudError) {
    if (isAbortError(soundCloudError, signal)) throw soundCloudError;
    log("yellow", "playback", `soundcloud resolution failed, searching youtube: ${String(soundCloudError)}`);
    try {
      return await resolveYoutubeStandIn(track, signal);
    } catch (standInError) {
      if (isAbortError(standInError, signal)) throw standInError;
      throw soundCloudError;
    }
  }
}

async function resolveYoutubeTrack(track: PlayableTrack, videoId: string, signal?: AbortSignal): Promise<PlaybackStream> {
  const liner = await resolveLinerStream(videoId, signal);
  if (liner) {
    log("cyan", "playback", `playing liner audio (r2) for "${track.title}"`);
    return fromLinerStream(liner, track);
  }
  return fromInnertubeStream(await resolveDirectAudioStream(track.id, { signal }));
}

export async function resolvePlaybackStream(track: PlayableTrack, signal?: AbortSignal): Promise<PlaybackStream> {
  try {
    const cachedUrl = await audioCache.getAudioSrc(track.id);
    if (cachedUrl) {
      log("green", "playback", `playing cached audio for "${track.title}"`);
      return {
        url: cachedUrl,
        mimeType: "audio/ogg",
        codec: "opus",
        bitrate: 160000,
        expiresAtMs: null,
      };
    }
  } catch {
    // ignore cache lookup errors and proceed with remote resolution
  }

  if (toSoundCloudTrackId(track.id)) return resolveSoundCloud(track, signal);
  const videoId = toVideoId(track.id);
  if (videoId) return resolveYoutubeTrack(track, videoId, signal);
  return resolveYoutubeStandIn(track, signal);
}
