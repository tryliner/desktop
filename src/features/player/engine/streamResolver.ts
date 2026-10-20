import { resolveDirectAudioStream, toVideoId } from "@/shared/media/innertube";
import { resolveSoundCloudStream, toSoundCloudTrackId } from "@/shared/media/soundcloud";
import { isAbortError } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";
import {
  fromInnertubeStream,
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

export async function resolvePlaybackStream(track: PlayableTrack, signal?: AbortSignal): Promise<PlaybackStream> {
  if (toSoundCloudTrackId(track.id)) return resolveSoundCloud(track, signal);
  if (toVideoId(track.id)) {
    try {
      return fromInnertubeStream(await resolveDirectAudioStream(track.id, { signal }));
    } catch (directError) {
      if (isAbortError(directError, signal)) throw directError;
      log("yellow", "playback", `direct resolution failed for "${track.title}" (${track.id}): ${String(directError)}`);
      try {
        return await resolveYoutubeStandIn(track, signal);
      } catch (standInError) {
        if (isAbortError(standInError, signal)) throw standInError;
        throw directError;
      }
    }
  }
  return resolveYoutubeStandIn(track, signal);
}
