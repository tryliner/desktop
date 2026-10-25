import { InnertubeError, type InnertubeProfile } from "./innertubeClient";
import { PLAYBACK_PROFILES } from "./playbackProfiles";
import { log } from "@/shared/utils/logger";
import {
  resetWebRemixSession,
  resolveWebRemixAudioStream,
} from "./webRemixAudio";
import { resolveWithProfile } from "./profileAudio";
import { assertStreamReachable } from "./streamProbe";
import type { ResolvedAudioStream } from "./innertubeAudioFormats";

export type { ResolvedAudioStream } from "./innertubeAudioFormats";

export {
  ANDROID_VR_PROFILE,
  PLAYBACK_PROFILES,
  TV_PROFILE,
  VISIONOS_PROFILE,
} from "./playbackProfiles";

let lastWorkingProfile: InnertubeProfile | null = null;

export function resetPlaybackProfilePreference(): void {
  lastWorkingProfile = null;
  webRemixRetryAt = 0;
  webRemixFailures = 0;
}

function orderedProfiles(
  profiles: readonly InnertubeProfile[],
): readonly InnertubeProfile[] {
  if (!lastWorkingProfile || !profiles.includes(lastWorkingProfile))
    return profiles;
  return [
    lastWorkingProfile,
    ...profiles.filter((profile) => profile !== lastWorkingProfile),
  ];
}

const WEB_REMIX_COOLDOWN_MS = 5 * 60 * 1000;

const WEB_REMIX_ATTEMPTS = 2;
const WEB_REMIX_FAILURES_BEFORE_COOLDOWN = 3;

let webRemixRetryAt = 0;
let webRemixFailures = 0;
let lastWebRemixError = "";

async function resolveViaWebRemix(
  videoId: string,
  options: ResolveAudioOptions,
  failures: string[],
): Promise<ResolvedAudioStream | null> {
  for (let attempt = 0; attempt < WEB_REMIX_ATTEMPTS; attempt += 1) {
    try {
      const stream = await resolveWebRemixAudioStream(videoId, options);
      await assertStreamReachable(
        stream.url,
        stream.contentLength,
        options.signal,
      );
      webRemixFailures = 0;
      return stream;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      resetWebRemixSession();
      const message = error instanceof Error ? error.message : String(error);
      lastWebRemixError = message;
      failures.push(`WEB_REMIX: ${message}`);
      log(
        "yellow",
        "playback",
        `WEB_REMIX attempt ${attempt + 1} failed: ${message}`,
      );
    }
  }
  webRemixFailures += 1;
  if (webRemixFailures >= WEB_REMIX_FAILURES_BEFORE_COOLDOWN) {
    webRemixRetryAt = Date.now() + WEB_REMIX_COOLDOWN_MS;
    webRemixFailures = 0;
    log(
      "yellow",
      "playback",
      "WEB_REMIX keeps failing, using app profiles for 5 min",
    );
  }
  return null;
}

export interface ResolveAudioOptions {
  signal?: AbortSignal;
  preferredCodec?: "opus" | "aac";
  profiles?: readonly InnertubeProfile[];
}

export function toVideoId(trackId: string): string | null {
  const videoId = trackId.replace(/^yt:/, "");
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
}

export async function resolveDirectAudioStream(
  trackId: string,
  options: ResolveAudioOptions = {},
): Promise<ResolvedAudioStream> {
  const videoId = toVideoId(trackId);
  if (!videoId)
    throw new InnertubeError(`Track ${trackId} is not a YouTube video.`, 400);
  const failures: string[] = [];
  if (!options.profiles && Date.now() >= webRemixRetryAt) {
    const stream = await resolveViaWebRemix(videoId, options, failures);
    if (stream) return stream;
  } else if (!options.profiles) {
    failures.push(`WEB_REMIX paused: ${lastWebRemixError}`);
  }
  for (const profile of orderedProfiles(
    options.profiles ?? PLAYBACK_PROFILES,
  )) {
    try {
      const stream = await resolveWithProfile(videoId, profile, options);
      lastWorkingProfile = profile;
      return stream;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      failures.push(
        `${profile.clientName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  throw new InnertubeError(
    `Direct audio resolution failed (${failures.join("; ")}).`,
    502,
  );
}
