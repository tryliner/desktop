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
const PAGE_ID_STORAGE_KEY = "liner_youtube_page_id";
const REVOKE_URL = "https://www.youtube.com/o/oauth2/revoke";
const REFRESH_MARGIN_MS = 60_000;
const TERMINAL_REFRESH_ERRORS = new Set([
  "invalid_grant",
  "unauthorized_client",
]);

type MainYoutubeAuthBridge = NonNullable<
  NonNullable<Window["linerElectron"]>["youtubeAuthSession"]
>;

let session: YoutubeAuthTokens | null | undefined;
let pageId: string | null | undefined;
let pendingRefresh: Promise<YoutubeAuthTokens | null> | null = null;

function mainBridge(): MainYoutubeAuthBridge | null {
  if (typeof window === "undefined") return null;
  return window.linerElectron?.youtubeAuthSession ?? null;
}

function readLocal(): YoutubeAuthTokens | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as YoutubeAuthTokens) : null;
  } catch {
    return null;
  }
}

function notifyChanged(): void {
  globalThis.dispatchEvent?.(new Event("youtube-auth:changed"));
}

function dropLocal(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {}
}

function load(): YoutubeAuthTokens | null {
  const bridge = mainBridge();
  if (!bridge) return readLocal();
  let stored: YoutubeAuthTokens | null = null;
  try {
    stored = bridge.get() as YoutubeAuthTokens | null;
  } catch (err) {
    console.error("[YouTube] reading the stored session failed:", err);
  }
  // older builds kept the tokens in plain localStorage: move them to main once
  const legacy = readLocal();
  if (legacy) {
    dropLocal();
    if (!stored && legacy.refreshToken) {
      void bridge
        .set(legacy)
        .catch((err) =>
          console.error("[YouTube] saving the session failed:", err),
        );
      stored = legacy;
    }
  }
  return stored;
}

function save(next: YoutubeAuthTokens | null): void {
  session = next;
  const bridge = mainBridge();
  if (bridge) {
    dropLocal();
    void bridge
      .set(next)
      .catch((err) =>
        console.error("[YouTube] saving the session failed:", err),
      );
  } else {
    try {
      if (next)
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
      else globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
  }
  notifyChanged();
}

function storePageId(next: string | null): void {
  pageId = next;
  try {
    if (next) globalThis.localStorage?.setItem(PAGE_ID_STORAGE_KEY, next);
    else globalThis.localStorage?.removeItem(PAGE_ID_STORAGE_KEY);
  } catch {
    return;
  }
}

export function getYoutubePageId(): string | null {
  if (pageId === undefined) {
    try {
      pageId = globalThis.localStorage?.getItem(PAGE_ID_STORAGE_KEY) ?? null;
    } catch {
      pageId = null;
    }
  }
  return pageId;
}

export function selectYoutubePageId(next: string | null): void {
  if (next === getYoutubePageId()) return;
  storePageId(next);
  notifyChanged();
}

export function getYoutubeSessionKey(): string | null {
  const tokens = getYoutubeAuthTokens();
  if (!tokens) return null;
  return `${tokens.refreshToken}:${getYoutubePageId() ?? ""}`;
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
  storePageId(null);
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
  storePageId(null);
  save(null);
  if (!current) return;
  await fetch(
    `${REVOKE_URL}?token=${encodeURIComponent(current.refreshToken)}`,
    {
      method: "POST",
    },
  ).catch(() => undefined);
}
