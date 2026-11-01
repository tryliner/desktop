import type {
  ResolvedAudioStream,
  TvAudioStream,
  TvProgressiveAudioStream,
} from "@/shared/youtube";
import type { ResolvedSoundCloudStream } from "@/shared/media/soundcloud";
import type { LinerAudioStream } from "@/shared/media/liner/linerPlayback";
import type { Track } from "@/shared/types";

export type PlaybackSource =
  "r2" | "youtube" | "youtube-tv" | "soundcloud" | "local";

interface PlaybackStreamFormat {
  mimeType: string;
  codec: string;
  bitrate: number;
  contentLength?: number;
  source?: PlaybackSource;
  standIn?: boolean;
}

export interface UrlPlaybackStream extends PlaybackStreamFormat {
  url: string;
  expiresAtMs: number | null;
  blob?: undefined;
  completed?: Promise<Blob>;
  needsFullSource?: () => boolean;
  release?: () => void;
  fromLiner?: boolean;
}

export interface BufferedPlaybackStream extends PlaybackStreamFormat {
  blob: Blob;
  expiresAtMs: null;
  url?: undefined;
  completed?: undefined;
  needsFullSource?: undefined;
  release?: undefined;
  fromLiner?: undefined;
}

export type PlaybackStream = UrlPlaybackStream | BufferedPlaybackStream;

export type PlayableTrack = Pick<
  Track,
  "id" | "title" | "artists" | "durationMs" | "artistList" | "audioVariant"
>;

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function fromInnertubeStream(
  direct: ResolvedAudioStream,
): PlaybackStream {
  return {
    url: direct.url,
    source: "youtube",
    mimeType: direct.mimeType,
    codec: direct.codec,
    bitrate: direct.bitrate,
    expiresAtMs: toTimestamp(direct.expiresAt),
    ...(direct.contentLength ? { contentLength: direct.contentLength } : {}),
  };
}

export function fromTvStream(stream: TvAudioStream): PlaybackStream {
  return {
    blob: stream.blob,
    source: "youtube-tv",
    mimeType: stream.mimeType,
    codec: stream.codec,
    bitrate: stream.bitrate,
    contentLength: stream.contentLength,
    expiresAtMs: null,
  };
}

export function fromTvProgressiveStream(
  stream: TvProgressiveAudioStream,
): PlaybackStream {
  return {
    url: stream.url,
    source: "youtube-tv",
    mimeType: stream.mimeType,
    codec: stream.codec,
    bitrate: stream.bitrate,
    expiresAtMs: null,
    completed: stream.completed,
    needsFullSource: stream.needsFullSource,
    release: stream.release,
    ...(stream.contentLength ? { contentLength: stream.contentLength } : {}),
  };
}

export function fromSoundCloudStream(
  stream: ResolvedSoundCloudStream,
): PlaybackStream {
  const format = {
    source: "soundcloud" as const,
    mimeType: stream.mimeType,
    codec: stream.codec,
    bitrate: stream.bitrate,
  };
  if (stream.blob) {
    return {
      ...format,
      blob: stream.blob,
      expiresAtMs: null,
      contentLength: stream.contentLength,
    };
  }
  return {
    ...format,
    url: stream.url,
    expiresAtMs: toTimestamp(stream.expiresAt),
    ...(stream.contentLength ? { contentLength: stream.contentLength } : {}),
  };
}

export function fromLinerStream(
  stream: LinerAudioStream,
  track: PlayableTrack,
): PlaybackStream {
  const seconds = track.durationMs ? track.durationMs / 1000 : 0;
  return {
    url: stream.url,
    source: "r2",
    mimeType: stream.mimeType,
    codec: stream.codec ?? "opus",
    fromLiner: true,
    bitrate: seconds > 0 ? Math.round((stream.size * 8) / seconds) : 0,
    expiresAtMs: toTimestamp(stream.expiresAt),
    ...(stream.size ? { contentLength: stream.size } : {}),
  };
}
