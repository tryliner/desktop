import { createHash } from "node:crypto";
import type {
  LastfmCredentials,
  LastfmListen,
  LastfmTrack,
} from "../src/features/lastfm/contracts";

export class LastfmError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export function lastfmSignature(
  params: Record<string, string>,
  secret: string,
): string {
  const input =
    Object.keys(params)
      .filter((key) => !["format", "callback", "api_sig"].includes(key))
      .sort()
      .map((key) => key + params[key])
      .join("") + secret;
  return createHash("md5").update(input, "utf8").digest("hex");
}

export function validCredentials(value: unknown): value is LastfmCredentials {
  if (!value || typeof value !== "object") return false;
  const { apiKey, secret } = value as LastfmCredentials;
  return (
    typeof apiKey === "string" &&
    /^[a-f0-9]{32}$/i.test(apiKey) &&
    typeof secret === "string" &&
    /^[a-f0-9]{32}$/i.test(secret)
  );
}

export function validLastfmTrack(value: unknown): value is LastfmTrack {
  if (!value || typeof value !== "object") return false;
  const t = value as LastfmTrack;
  return (
    [t.artist, t.track].every(
      (s) => typeof s === "string" && s.trim().length > 0 && s.length <= 1024,
    ) &&
    (t.album === undefined ||
      (typeof t.album === "string" && t.album.length <= 1024)) &&
    Number.isFinite(t.duration) &&
    t.duration > 0 &&
    t.duration <= 86400 &&
    (t.chosenByUser === undefined ||
      t.chosenByUser === 0 ||
      t.chosenByUser === 1)
  );
}

export function validLastfmListen(value: unknown): value is LastfmListen {
  if (!validLastfmTrack(value)) return false;
  const t = value as LastfmListen;
  return (
    t.duration > 30 &&
    typeof t.id === "string" &&
    t.id.length > 0 &&
    t.id.length <= 128 &&
    Number.isSafeInteger(t.timestamp) &&
    t.timestamp > 0 &&
    t.timestamp <= Math.floor(Date.now() / 1000) + 60
  );
}

function trackParams(track: LastfmTrack, suffix = ""): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of [
    "artist",
    "track",
    "album",
    "duration",
    "chosenByUser",
  ] as const) {
    const value = track[key];
    if (value !== undefined && value !== "")
      params[key + suffix] = String(value);
  }
  return params;
}

export class LastfmApi {
  constructor(private readonly fetch: typeof globalThis.fetch) {}

  async request(
    credentials: LastfmCredentials,
    method: string,
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Record<string, any>> {
    const fields = { ...params, method, api_key: credentials.apiKey };
    const body = new URLSearchParams({
      ...fields,
      api_sig: lastfmSignature(fields, credentials.secret),
      format: "json",
    });
    const response = await this.fetch("https://ws.audioscrobbler.com/2.0/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
    let data: Record<string, any>;
    try {
      data = await response.json();
    } catch {
      throw new LastfmError(16, "Last.fm returned an unreadable response.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new LastfmError(16, "Last.fm returned an invalid response.");
    if (data.error !== undefined) {
      const code = Number(data.error);
      throw new LastfmError(
        Number.isFinite(code) ? code : 16,
        `Last.fm error ${code}.`,
      );
    }
    if (!response.ok)
      throw new LastfmError(
        response.status === 429 ? 29 : response.status >= 500 ? 16 : 6,
        `Last.fm HTTP ${response.status}.`,
      );
    return data;
  }

  nowPlaying(
    credentials: LastfmCredentials,
    sk: string,
    track: LastfmTrack,
    signal: AbortSignal,
  ) {
    return this.request(
      credentials,
      "track.updateNowPlaying",
      { ...trackParams(track), sk },
      signal,
    );
  }

  scrobble(
    credentials: LastfmCredentials,
    sk: string,
    listens: LastfmListen[],
    signal: AbortSignal,
  ) {
    const params: Record<string, string> = { sk };
    listens.forEach((listen, index) => {
      const suffix = `[${index}]`;
      Object.assign(params, trackParams(listen, suffix));
      params[`timestamp${suffix}`] = String(listen.timestamp);
    });
    return this.request(credentials, "track.scrobble", params, signal);
  }
}
