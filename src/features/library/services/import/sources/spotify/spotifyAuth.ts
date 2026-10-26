import {
  asRecord,
  numberValue,
  recordAt,
  stringValue,
} from "@/shared/utils/json";
import { fetchSpotifySecret, fetchSpotifyServerTime } from "./spotifySecret";
import { generateTotp, spotifySecretBytes } from "./spotifyTotp";

export interface SpotifySession {
  accessToken: string;
  clientToken: string;
  expiresAt: number;
}

export const SPOTIFY_CLIENT_VERSION = "1.3.2.216.g7f3fbea1";

let cachedSpotifySession: SpotifySession | null = null;

export function resetSpotifySessionCache(): void {
  cachedSpotifySession = null;
}

async function fetchAccessToken(
  signal?: AbortSignal,
): Promise<{ accessToken: string; expiresAt: number }> {
  const { secret, version } = await fetchSpotifySecret(signal);
  const secretBytes = spotifySecretBytes(secret);
  const serverTime = await fetchSpotifyServerTime(signal);
  const totp = await generateTotp(secretBytes, Date.now());
  const totpServer = serverTime
    ? await generateTotp(secretBytes, serverTime * 1000)
    : "unavailable";

  const params = new URLSearchParams({
    reason: "init",
    productType: "web-player",
    totp,
    totpServer,
    totpVer: String(version),
  });
  const response = await fetch(
    `https://open.spotify.com/api/token?${params.toString()}`,
    {
      headers: { accept: "application/json" },
      signal,
    },
  );
  if (!response.ok)
    throw new Error(
      `Failed to obtain Spotify guest token (${response.status})`,
    );

  const data = asRecord((await response.json()) as unknown);
  const accessToken = stringValue(data?.accessToken);
  if (!accessToken)
    throw new Error("Spotify guest token response missing accessToken");
  const expiresAt =
    numberValue(data?.accessTokenExpirationTimestampMs) ??
    Date.now() + 3500_000;
  return { accessToken, expiresAt };
}

async function fetchClientToken(signal?: AbortSignal): Promise<string> {
  const response = await fetch(
    "https://clienttoken.spotify.com/v1/clienttoken",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_data: {
          client_version: SPOTIFY_CLIENT_VERSION,
          client_id: "d8a5ed958d274c2e8ee717e6a4b0971d",
          js_sdk_data: {
            device_brand: "Apple",
            device_model: "unknown",
            os: "macOS",
            os_version: "unknown",
            device_id: "d9b7ebf9-813c-4c6e-8d82-841f71a0670d",
            device_type: "computer",
            platform_identifier: "web-player",
          },
        },
      }),
      signal,
    },
  );
  const data: unknown = await response.json();
  return stringValue(recordAt(data, "granted_token")?.token) ?? "";
}

export async function getSpotifyGuestSession(
  signal?: AbortSignal,
): Promise<SpotifySession> {
  if (
    cachedSpotifySession &&
    Date.now() < cachedSpotifySession.expiresAt - 60_000
  ) {
    return cachedSpotifySession;
  }
  const { accessToken, expiresAt } = await fetchAccessToken(signal);
  const clientToken = await fetchClientToken(signal);
  cachedSpotifySession = { accessToken, clientToken, expiresAt };
  return cachedSpotifySession;
}
