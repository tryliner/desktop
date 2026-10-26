import { getAuthSession, getValidAccessToken } from "@/shared/api/auth-session";
import { getApiBaseUrl } from "@/shared/api/baseUrl";
import { isAbortError } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";

export interface LinerAudioStream {
  url: string;
  expiresAt: string;
  mimeType: string;
  codec?: string;
  size: number;
}

const REQUEST_TIMEOUT_MS = 5_000;
const UNAVAILABLE_BACKOFF_MS = 10 * 60_000;

let pausedUntil = 0;

function pause(ms: number, reason: string): void {
  pausedUntil = Date.now() + ms;
  log("yellow", "playback", `liner audio paused for ${Math.round(ms / 1000)}s: ${reason}`);
}

// presigned r2 url, or null so the caller falls back to youtube
export async function resolveLinerStream(videoId: string, signal?: AbortSignal): Promise<LinerAudioStream | null> {
  if (Date.now() < pausedUntil || !getAuthSession()?.accessToken) return null;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    const token = await getValidAccessToken();
    if (!token) return null;
    const res = await fetch(`${getApiBaseUrl()}/v1/tracks/${encodeURIComponent(videoId)}/playback`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (res.ok) return (await res.json()) as LinerAudioStream;

    const body = (await res.json().catch(() => ({}))) as { code?: string; retryAfterSeconds?: number };
    if (res.status === 404 && body.code === "PLAYBACK_NOT_FOUND") return null;
    if (res.status === 429) pause(Math.max(1, body.retryAfterSeconds ?? 60) * 1000, "rate limited");
    else if (res.status === 404 || res.status === 503) pause(UNAVAILABLE_BACKOFF_MS, `api answered ${res.status}`);
    return null;
  } catch (error) {
    if (isAbortError(error, signal) && signal?.aborted) throw error;
    log("yellow", "playback", `liner audio lookup failed, using youtube: ${String(error)}`);
    return null;
  }
}

export function resetLinerPlaybackPause(): void {
  pausedUntil = 0;
}
