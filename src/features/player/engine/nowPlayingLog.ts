import { log, type LogColor } from "@/shared/utils/logger";
import type { PlaybackSource, PlaybackStream } from "./playbackStream";

const SOURCE_COLORS: Record<PlaybackSource, LogColor> = {
  r2: "yellow",
  youtube: "red",
  "youtube-tv": "magenta",
  soundcloud: "blue",
  local: "gray",
};

interface StreamOrigin {
  source: PlaybackSource;
  standIn: boolean;
  codec: string;
  bitrate: number;
}

const origins = new Map<string, StreamOrigin>();

export function rememberStreamOrigin(trackId: string, stream: PlaybackStream) {
  origins.set(trackId, {
    source: stream.source ?? "youtube",
    standIn: Boolean(stream.standIn),
    codec: stream.codec,
    bitrate: stream.bitrate,
  });
}

interface NowPlayingTrack {
  id: string;
  title: string;
  artists: string;
}

export function logNowPlaying(
  track: NowPlayingTrack,
  fromCache: boolean,
  latencyMs: number,
): void {
  const origin = origins.get(track.id);
  const details: string[] = [];
  if (origin?.standIn) details.push("youtube stand-in");
  if (origin?.codec) details.push(origin.codec);
  if (origin?.bitrate)
    details.push(`${Math.round(origin.bitrate / 1000)} kbps`);
  if (fromCache) details.push("from cache");
  details.push(`${latencyMs} ms`);
  log(
    origin ? SOURCE_COLORS[origin.source] : "gray",
    origin?.source ?? "cache",
    `now playing "${track.title}" — ${track.artists} · ${details.join(" · ")}`,
  );
}
