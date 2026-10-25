import { InnertubeError } from "../innertube/innertubeClient";
import { TV_PROFILE } from "../innertube/playbackProfiles";
import { USER_AGENT_HEADER_OVERRIDE } from "../innertube/userAgentOverride";
import type { TvSession } from "./tvWorker";

const PLAYER_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const CPN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export interface TvPlayerRequest {
  videoId: string;
  session: TvSession;
  signatureTimestamp: number;
  authorization: string;
  cpn: string;
  signal?: AbortSignal;
}

export function createCpn(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => CPN_ALPHABET[byte & 63],
  ).join("");
}

export function tvUserAgent(): string {
  return TV_PROFILE.userAgent ?? "";
}

export async function requestTvPlayer(
  request: TvPlayerRequest,
): Promise<unknown> {
  const { session } = request;
  const response = await fetch(PLAYER_URL, {
    method: "POST",
    signal: request.signal,
    headers: {
      "content-type": "application/json",
      authorization: request.authorization,
      "x-youtube-client-name": TV_PROFILE.clientIdHeader,
      "x-youtube-client-version": session.clientVersion,
      "x-goog-visitor-id": session.visitorData,
      [USER_AGENT_HEADER_OVERRIDE]: tvUserAgent(),
    },
    body: JSON.stringify({
      videoId: request.videoId,
      cpn: request.cpn,
      contentCheckOk: true,
      racyCheckOk: true,
      context: {
        client: {
          clientName: TV_PROFILE.clientName,
          clientVersion: session.clientVersion,
          hl: "en",
          gl: "US",
          userAgent: tvUserAgent(),
          visitorData: session.visitorData,
          tvAppInfo: { livingRoomPoTokenId: session.livingRoomPoTokenId },
        },
        user: { lockedSafetyMode: false },
      },
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: "HTML5_PREF_WANTS",
          signatureTimestamp: request.signatureTimestamp,
        },
      },
    }),
  });
  if (!response.ok)
    throw new InnertubeError(
      `YouTube TV player failed with HTTP ${response.status}.`,
      response.status,
    );
  return response.json();
}
