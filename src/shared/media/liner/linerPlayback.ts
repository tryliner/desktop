import { getAuthSession, getValidAccessToken } from "@/shared/api/auth-session";
import { getApiBaseUrl } from "@/shared/api/baseUrl";
import { buildRoute } from "@/shared/api/route";
import type { ApiResponse, R2Plan } from "@/shared/contracts";
import { isAbortError } from "@/shared/utils/abort";
import { log } from "@/shared/utils/logger";

/** A presigned R2 url of the track's audio (`source: "r2"` plan). */
export type LinerAudioStream = R2Plan;

type PlaybackPlan = ApiResponse<"POST /v1/tracks/:trackId/playback">;

const REQUEST_TIMEOUT_MS = 5_000;
const STREAM_FAILED_BACKOFF_MS = 10 * 60_000;
const NETWORK_BACKOFF_MS = 60_000;

let pausedUntil = 0;

function pause(ms: number, reason: string): void {
  pausedUntil = Date.now() + ms;
  log(
    "yellow",
    "playback",
    `liner audio paused for ${Math.round(ms / 1000)}s: ${reason}`,
  );
}

// the api answers every lookup with a plan: an r2 url, or "play it from the
// source yourself" with a reason. Budget, caps and a missing r2 come with
// retryAfterSeconds, the time before asking again makes sense. Null means:
// play from youtube / soundcloud
export async function resolveLinerStream(
  videoId: string,
  signal?: AbortSignal,
): Promise<LinerAudioStream | null> {
  if (Date.now() < pausedUntil || !getAuthSession()?.accessToken) return null;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    const token = await Promise.race([
      getValidAccessToken(),
      new Promise<null>((resolve) =>
        timeout.addEventListener("abort", () => resolve(null), { once: true }),
      ),
    ]);
    if (!token) return null;
    const { method, path } = buildRoute("POST /v1/tracks/:trackId/playback", {
      params: { trackId: videoId },
    });
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    // 400 (an id the api does not take), 401, 500: play from the source
    if (!res.ok) return null;
    const plan = (await res.json()) as PlaybackPlan;
    if (plan.source === "r2") return plan;
    if (plan.retryAfterSeconds)
      pause(plan.retryAfterSeconds * 1000, plan.reason);
    return null;
  } catch (error) {
    if (isAbortError(error, signal) && signal?.aborted) throw error;
    pause(NETWORK_BACKOFF_MS, `lookup failed: ${String(error)}`);
    return null;
  }
}

// the api answered but r2 itself is unreachable for this client (tls mitm, blocked
// cloudflare): stop handing out r2 urls for a while so retries go to youtube
export function markLinerStreamFailed(reason: string): void {
  pause(STREAM_FAILED_BACKOFF_MS, `r2 stream failed: ${reason}`);
}
