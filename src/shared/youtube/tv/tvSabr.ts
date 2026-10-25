import { SabrStream } from "googlevideo/sabr-stream";
import { VideoPlaybackAbrRequest } from "googlevideo/protos";
import {
  base64ToU8,
  buildSabrFormat,
  EnabledTrackTypes,
} from "googlevideo/utils";
import { USER_AGENT_HEADER_OVERRIDE } from "../innertube/userAgentOverride";
import type { TvPlayerData } from "./tvPlayerResponse";
import { tvUserAgent } from "./tvPlayerRequest";

const TV_CLIENT_NAME = 7;
const TV_CLIENT_INFO = {
  hl: "en_US",
  deviceMake: "Unknown",
  deviceModel: "Unknown",
  osName: "Unknown_0",
};

export interface TvSabrDownload {
  url: string;
  player: TvPlayerData;
  clientVersion: string;
  poToken: string;
  videoId: string;
}

export interface TvSabrFormat {
  mimeType: string;
  bitrate: number;
  contentLength: number;
  durationMs: number;
}

export interface TvSabrStream {
  format: TvSabrFormat;
  reader: ReadableStreamDefaultReader<ArrayBufferView<ArrayBufferLike>>;
  abort: () => void;
}

function withTvClientInfo(
  body: BodyInit | null | undefined,
): BodyInit | null | undefined {
  if (!(body instanceof Uint8Array)) return body;
  const request = VideoPlaybackAbrRequest.decode(body);
  request.streamerContext = {
    sabrContexts: [],
    unsentSabrContexts: [],
    ...request.streamerContext,
    clientInfo: { ...request.streamerContext?.clientInfo, ...TV_CLIENT_INFO },
  };
  return VideoPlaybackAbrRequest.encode(request).finish();
}

const tvFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set(USER_AGENT_HEADER_OVERRIDE, tvUserAgent());
  return fetch(input, { ...init, headers, body: withTvClientInfo(init.body) });
};

export function copyChunk(
  value: ArrayBufferView<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  const chunk = new Uint8Array(value.byteLength);
  chunk.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return chunk;
}

export function startTvSabr(download: TvSabrDownload): TvSabrStream {
  const poToken = base64ToU8(download.poToken);
  const stream = new SabrStream({
    videoId: download.videoId,
    formats: download.player.formats.map(buildSabrFormat),
    serverAbrStreamingUrl: download.url,
    videoPlaybackUstreamerConfig: download.player.ustreamerConfig,
    clientInfo: {
      clientName: TV_CLIENT_NAME,
      clientVersion: download.clientVersion,
    },
    poToken: download.poToken,
    fetchFunction: tvFetch,
    callbacks: { onMintPoToken: () => Promise.resolve(poToken) },
  });
  const { audioStream, selectedFormats } = stream.start({
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
    audioPreferences: { container: "webm" },
    isPostLiveDvr: false,
  });
  const audio = selectedFormats.audioFormat;
  return {
    format: {
      mimeType: audio.mimeType ?? 'audio/webm; codecs="opus"',
      bitrate: audio.averageBitrate ?? audio.bitrate,
      contentLength: audio.contentLength ?? 0,
      durationMs: Number(audio.approxDurationMs) || 0,
    },
    reader: audioStream.getReader(),
    abort: () => void stream.abort(),
  };
}
