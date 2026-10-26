import { getTvOauthClient } from "./tvOauthClient";
import {
  pollTvDeviceToken,
  requestTvDeviceCode,
  type TvDeviceCode,
} from "./tvDeviceFlow";
import {
  refreshTvTokens,
  toAuthorizationHeader,
  YoutubeAuthError,
  type YoutubeAuthTokens,
} from "./tvTokens";

const STORAGE_KEY = "liner_youtube_tv_session";
const REVOKE_URL = "https://www.youtube.com/o/oauth2/revoke";
const REFRESH_MARGIN_MS = 60_000;
const TERMINAL_REFRESH_ERRORS = new Set([
  "invalid_grant",
  "unauthorized_client",
]);

let session: YoutubeAuthTokens | null | undefined;
let pendingRefresh: Promise<YoutubeAuthTokens | null> | null = null;

function load(): YoutubeAuthTokens | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as YoutubeAuthTokens) : null;
  } catch {
    return null;
  }
}

function save(next: YoutubeAuthTokens | null): void {
  session = next;
  try {
    if (next)
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
  globalThis.dispatchEvent?.(new Event("youtube-auth:changed"));
}

export function getYoutubeAuthTokens(): YoutubeAuthTokens | null {
  if (session === undefined) session = load();
  return session;
}

export function isYoutubeSignedIn(): boolean {
  return getYoutubeAuthTokens() !== null;
}

export function startYoutubeTvSignIn(
  signal?: AbortSignal,
): Promise<TvDeviceCode> {
  return getTvOauthClient(signal).then((client) =>
    requestTvDeviceCode(client, signal),
  );
}

export async function completeYoutubeTvSignIn(
  code: TvDeviceCode,
  signal?: AbortSignal,
): Promise<YoutubeAuthTokens> {
  const tokens = await pollTvDeviceToken(
    await getTvOauthClient(signal),
    code,
    signal,
  );
  save(tokens);
  return tokens;
}

async function refresh(
  current: YoutubeAuthTokens,
  signal?: AbortSignal,
): Promise<YoutubeAuthTokens | null> {
  try {
    const next = await refreshTvTokens(
      await getTvOauthClient(signal),
      current.refreshToken,
      signal,
    );
    save(next);
    return next;
  } catch (error) {
    if (
      error instanceof YoutubeAuthError &&
      TERMINAL_REFRESH_ERRORS.has(error.code)
    )
      save(null);
    throw error;
  }
}

export async function getYoutubeAuthorization(
  signal?: AbortSignal,
): Promise<string | null> {
  const current = getYoutubeAuthTokens();
  if (!current) return null;
  if (current.expiresAt - REFRESH_MARGIN_MS > Date.now())
    return toAuthorizationHeader(current);
  pendingRefresh ??= refresh(current, signal).finally(() => {
    pendingRefresh = null;
  });
  const next = await pendingRefresh;
  return next ? toAuthorizationHeader(next) : null;
}

export async function signOutYoutube(): Promise<void> {
  const current = getYoutubeAuthTokens();
  save(null);
  if (!current) return;
  await fetch(
    `${REVOKE_URL}?token=${encodeURIComponent(current.refreshToken)}`,
    {
      method: "POST",
    },
  ).catch(() => undefined);
}
