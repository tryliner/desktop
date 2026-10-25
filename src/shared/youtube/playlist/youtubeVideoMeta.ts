import { asArray, asRecord, recordAt, stringValue } from "@/shared/utils/json";
import { rethrowIfAborted } from "@/shared/utils/abort";
import { tryFetchJson } from "@/shared/api/tryFetch";
import { getRuns } from "../innertube/innertubeJson";
import { postInnertube } from "../innertube/innertubeClient";

export interface YoutubeVideoMeta {
  title?: string;
  artist?: string;
}

async function fetchOembed(
  videoId: string,
  signal?: AbortSignal,
): Promise<YoutubeVideoMeta> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const data = asRecord(
    await tryFetchJson(
      `https://www.youtube.com/oembed?url=${watchUrl}&format=json`,
      { signal },
    ),
  );
  return {
    title: stringValue(data?.title) || undefined,
    artist: stringValue(data?.author_name) || undefined,
  };
}

async function fetchWatchNext(
  videoId: string,
  signal?: AbortSignal,
): Promise<YoutubeVideoMeta> {
  try {
    const body = await postInnertube("next", { videoId }, { signal });
    const tabs = asArray(
      recordAt(
        body,
        "contents",
        "singleColumnMusicWatchNextResultsRenderer",
        "tabbedRenderer",
        "watchNextTabbedResultsRenderer",
      )?.tabs,
    );
    const panel = recordAt(
      tabs[0],
      "tabRenderer",
      "content",
      "musicQueueRenderer",
      "content",
      "playlistPanelRenderer",
    );
    const item = recordAt(
      asArray(panel?.contents)[0],
      "playlistPanelVideoRenderer",
    );
    return {
      title: stringValue(getRuns(item?.title)[0]?.text) || undefined,
      artist: stringValue(getRuns(item?.longBylineText)[0]?.text) || undefined,
    };
  } catch {
    rethrowIfAborted(signal);
    return {};
  }
}

export async function fetchYoutubeVideoMeta(
  videoId: string,
  signal?: AbortSignal,
): Promise<YoutubeVideoMeta> {
  const oembed = await fetchOembed(videoId, signal);
  const next = await fetchWatchNext(videoId, signal);
  return {
    title: next.title ?? oembed.title,
    artist: next.artist ?? oembed.artist,
  };
}
