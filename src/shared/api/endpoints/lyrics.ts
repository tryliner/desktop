import { ApiError } from "../apiError";
import { getValidAccessToken } from "../auth-session";
import { getApiBaseUrl } from "../baseUrl";
import { call } from "../call";
import { signApiRequest, syncServerTime } from "../requestSigner";
import { buildRoute } from "../route";
import { instrumentalAnswer, readLyricsEvents } from "./lyricsEvents";
import type { LyricsSearchResult, LyricsStreamEvent } from "@/shared/contracts";

const LYRICS_CONNECT_TIMEOUT_MS = 12000;

type LyricsHint = { title: string; artist: string; durationMs?: number };

function hintQuery(hint: LyricsHint) {
  return {
    title: hint.title.trim(),
    artist: hint.artist.trim(),
    durationMs:
      hint.durationMs && hint.durationMs > 0
        ? String(Math.round(hint.durationMs))
        : undefined,
  };
}

async function connect(
  path: string,
  signal: AbortSignal | undefined,
): Promise<Response> {
  const signedHeaders = await signApiRequest("GET", path);
  const accessToken = await getValidAccessToken();
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), LYRICS_CONNECT_TIMEOUT_MS);
  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      signal: signal
        ? AbortSignal.any([signal, timeout.signal])
        : timeout.signal,
      headers: {
        Accept: "application/json, text/event-stream",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...signedHeaders,
      },
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (timeout.signal.aborted)
      throw new ApiError(0, "Lyrics request timed out.", "TIMEOUT_ERROR");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const lyricsApi = {
  async searchLyrics(
    hint: LyricsHint,
    signal?: AbortSignal,
  ): Promise<LyricsSearchResult | null> {
    try {
      const answer = await call(
        "GET /v1/me/lyrics/search",
        { query: hintQuery(hint) },
        { signal },
      );
      return answer as LyricsSearchResult;
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 404 &&
        err.code === "LYRICS_NOT_FOUND"
      ) {
        return null;
      }
      throw err;
    }
  },

  async *streamLyrics(
    id: string,
    signal?: AbortSignal,
    hint?: LyricsHint,
  ): AsyncGenerator<LyricsStreamEvent> {
    const query =
      hint?.title.trim() && hint.artist.trim() ? hintQuery(hint) : {};
    const { path } = buildRoute("GET /v1/tracks/:id/lyrics", {
      params: { id },
      query,
    });
    const res = await connect(path, signal);
    const date = res.headers?.get?.("date");
    if (date) syncServerTime(date);

    if (!res.ok || !res.body) {
      const requestId = res.headers?.get?.("x-request-id") ?? undefined;
      throw new ApiError(res.status, res.statusText, undefined, requestId);
    }
    if (res.headers.get("content-type")?.includes("application/json")) {
      yield instrumentalAnswer(await res.json());
      return;
    }
    yield* readLyricsEvents(res.body);
  },
};
