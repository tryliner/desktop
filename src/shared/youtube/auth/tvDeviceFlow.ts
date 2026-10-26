import { asRecord, numberValue, stringValue } from "@/shared/utils/json";
import type { TvOauthClient } from "./tvOauthClient";
import {
  requestTvToken,
  YoutubeAuthError,
  type YoutubeAuthTokens,
} from "./tvTokens";

const DEVICE_CODE_URL = "https://www.youtube.com/o/oauth2/device/code";
const TV_SCOPE =
  "http://gdata.youtube.com https://www.googleapis.com/auth/youtube-paid-content";
const DEVICE_GRANT = "http://oauth.net/grant_type/device/1.0";
const SLOW_DOWN_STEP_MS = 5000;

export interface TvDeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  activationUrl: string;
  expiresAt: number;
  intervalMs: number;
}

export async function requestTvDeviceCode(
  client: TvOauthClient,
  signal?: AbortSignal,
): Promise<TvDeviceCode> {
  const response = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: client.clientId,
      scope: TV_SCOPE,
      device_id: crypto.randomUUID(),
      device_model: "ytlr::",
    }),
    signal,
  });
  const body = asRecord((await response.json().catch(() => null)) as unknown);
  const deviceCode = stringValue(body?.device_code);
  const userCode = stringValue(body?.user_code);
  const verificationUrl = stringValue(body?.verification_url);
  if (!response.ok || !deviceCode || !userCode || !verificationUrl) {
    throw new YoutubeAuthError(stringValue(body?.error) ?? "device_code");
  }
  return {
    deviceCode,
    userCode,
    verificationUrl,
    activationUrl: `${verificationUrl}?user_code=${encodeURIComponent(userCode)}`,
    expiresAt: Date.now() + (numberValue(body?.expires_in) ?? 1800) * 1000,
    intervalMs: (numberValue(body?.interval) ?? 5) * 1000,
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function pollTvDeviceToken(
  client: TvOauthClient,
  code: TvDeviceCode,
  signal?: AbortSignal,
): Promise<YoutubeAuthTokens> {
  let intervalMs = code.intervalMs;
  while (Date.now() < code.expiresAt) {
    await wait(intervalMs, signal);
    const result = await requestTvToken(
      {
        client_id: client.clientId,
        client_secret: client.clientSecret,
        code: code.deviceCode,
        grant_type: DEVICE_GRANT,
      },
      signal,
    );
    if (result.status === "granted") return result.tokens;
    if (result.error === "slow_down") intervalMs += SLOW_DOWN_STEP_MS;
    else if (result.error !== "authorization_pending") {
      throw new YoutubeAuthError(result.error);
    }
  }
  throw new YoutubeAuthError("expired_token");
}
