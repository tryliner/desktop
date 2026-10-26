import {
  InnertubeError,
  postInnertube,
  type InnertubeProfile,
} from "./innertubeClient";
import { resetClientVisitorData } from "../session/visitorSession";
import { getWebPlayer, type WebPlayer } from "./webRemixAudio";
import { assertStreamReachable } from "./streamProbe";
import {
  extractAudioFormats,
  playabilityError,
  requiresBotCheck,
  selectBestAudioFormat,
  toResolvedStream,
  type AudioFormat,
  type ResolvedAudioStream,
} from "./innertubeAudioFormats";

export interface ProfileAudioOptions {
  signal?: AbortSignal;
  preferredCodec?: "opus" | "aac";
}

function playerBody(
  videoId: string,
  player: WebPlayer | null,
): Record<string, unknown> {
  return {
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
    ...(player
      ? {
          playbackContext: {
            contentPlaybackContext: {
              signatureTimestamp: player.signature_timestamp,
            },
          },
        }
      : {}),
  };
}

async function streamUrl(
  format: AudioFormat,
  player: WebPlayer | null,
): Promise<string> {
  if (!player) return format.url;
  return player.decipher(format.url || undefined, format.signatureCipher);
}

export async function resolveWithProfile(
  videoId: string,
  profile: InnertubeProfile,
  options: ProfileAudioOptions,
): Promise<ResolvedAudioStream> {
  const player = profile.requiresJsPlayer ? await getWebPlayer() : null;
  const request = () =>
    postInnertube("player", playerBody(videoId, player), {
      profile,
      signal: options.signal,
    });
  let response = await request();
  if (requiresBotCheck(response)) {
    resetClientVisitorData();
    response = await request();
  }
  const unplayable = playabilityError(response);
  if (unplayable) throw new InnertubeError(unplayable, 403);
  const formats = extractAudioFormats(response).filter(
    (format) => player || format.url,
  );
  const best = selectBestAudioFormat(formats, options.preferredCodec);
  if (!best)
    throw new InnertubeError(
      `${profile.clientName} returned no direct audio formats.`,
      502,
    );
  const url = await streamUrl(best, player);
  if (!url)
    throw new InnertubeError(
      `${profile.clientName} stream url could not be deciphered.`,
      502,
    );
  const stream = toResolvedStream({ ...best, url });
  await assertStreamReachable(stream.url, stream.contentLength, options.signal);
  return stream;
}
