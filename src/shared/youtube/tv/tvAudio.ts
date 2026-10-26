import { InnertubeError } from "../innertube/innertubeClient";
import { prepareTvDownload, throwIfAborted } from "./tvPrepare";
import { copyChunk, startTvSabr, type TvSabrStream } from "./tvSabr";
import { canFeedMediaSource, createMediaSourceFeed } from "./tvMediaSource";

export interface TvAudioStream {
  blob: Blob;
  mimeType: string;
  codec: "opus" | "aac";
  bitrate: number;
  contentLength: number;
}

export interface TvProgressiveAudioStream {
  url: string;
  mimeType: string;
  codec: "opus" | "aac";
  bitrate: number;
  contentLength: number;
  completed: Promise<Blob>;
  needsFullSource: () => boolean;
  release: () => void;
}

export interface TvAudioOptions {
  signal?: AbortSignal;
}

const baseMime = (mimeType: string) => mimeType.split(";")[0] ?? "audio/webm";
const codecOf = (mimeType: string) =>
  mimeType.includes("mp4") ? "aac" : "opus";

async function readFirstChunk(
  sabr: TvSabrStream,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const onAbort = () => sabr.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const { done, value } = await sabr.reader.read();
    throwIfAborted(signal);
    if (done || !value?.byteLength)
      throw new InnertubeError("YouTube TV stream returned no audio.", 502);
    return copyChunk(value);
  } catch (error) {
    sabr.abort();
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function resolveTvAudioStream(
  videoId: string,
  options: TvAudioOptions = {},
): Promise<TvAudioStream> {
  const sabr = startTvSabr(await prepareTvDownload(videoId, options.signal));
  const chunks = [await readFirstChunk(sabr, options.signal)];
  const onAbort = () => sabr.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for (;;) {
      const { done, value } = await sabr.reader.read();
      if (done) break;
      chunks.push(copyChunk(value));
    }
    throwIfAborted(options.signal);
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
  const blob = new Blob(chunks, { type: baseMime(sabr.format.mimeType) });
  return {
    blob,
    mimeType: blob.type,
    codec: codecOf(sabr.format.mimeType),
    bitrate: sabr.format.bitrate,
    contentLength: blob.size,
  };
}

export async function openTvAudioStream(
  videoId: string,
  options: TvAudioOptions = {},
): Promise<TvProgressiveAudioStream> {
  const sabr = startTvSabr(await prepareTvDownload(videoId, options.signal));
  const { format } = sabr;
  if (!canFeedMediaSource(format.mimeType)) {
    sabr.abort();
    throw new InnertubeError(
      `MediaSource cannot play ${format.mimeType}.`,
      415,
    );
  }
  const first = await readFirstChunk(sabr, options.signal);
  const feed = createMediaSourceFeed(format.mimeType, format.durationMs / 1000);
  const chunks = [first];
  feed.append(first);
  const completed = (async () => {
    try {
      for (;;) {
        const { done, value } = await sabr.reader.read();
        if (done) break;
        const chunk = copyChunk(value);
        chunks.push(chunk);
        feed.append(chunk);
      }
      feed.end();
      return new Blob(chunks, { type: baseMime(format.mimeType) });
    } catch (error) {
      feed.fail();
      throw error;
    }
  })();
  completed.catch(() => undefined);
  return {
    url: feed.url,
    mimeType: baseMime(format.mimeType),
    codec: codecOf(format.mimeType),
    bitrate: format.bitrate,
    contentLength: format.contentLength,
    completed,
    needsFullSource: feed.overflowed,
    release: () => {
      sabr.abort();
      feed.dispose();
    },
  };
}
