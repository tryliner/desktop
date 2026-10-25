import { createMinter, readChallenge, type MinterEntry } from "./botguard";

const TV_USER_AGENT =
  "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)";
const TV_HEADERS = { "x-liner-user-agent": TV_USER_AGENT };
const TV_API_KEY = "AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw";

export interface TvSession {
  poToken: string;
  livingRoomPoTokenId: string;
  visitorData: string;
  clientVersion: string;
  playerId: string;
}

interface CachedSession {
  session: TvSession;
  expiresAt: number;
}

let cached: CachedSession | null = null;
let pending: Promise<CachedSession> | null = null;

function capture(source: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(source)?.[1];
  if (!value) throw new Error(`YouTube TV page has no ${label}`);
  return value.replace(/\\u003d/g, "=");
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(path, { headers: TV_HEADERS });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.text();
}

function readTvChallenge(config: string) {
  const requestKey = capture(
    config,
    /"challengeRequestKey":"(.*?)"/,
    "request key",
  );
  const params = /"challengeParams":\{"R":"(.*?[^\\])","T"/s.exec(config)?.[1];
  if (!params) throw new Error("YouTube TV config has no challenge");
  const raw = JSON.parse(JSON.parse(`{"r":"${params}"}`).r) as {
    bgChallenge?: Parameters<typeof readChallenge>[0];
  };
  return { requestKey, challenge: readChallenge(raw.bgChallenge) };
}

async function generateTvIntegrityToken(
  requestKey: string,
  botguardResponse: string,
) {
  const response = await fetch("/api/jnn/v1/GenerateIT", {
    method: "POST",
    headers: {
      "content-type": "application/json+protobuf",
      "x-goog-api-key": TV_API_KEY,
    },
    body: JSON.stringify([requestKey, botguardResponse]),
  });
  if (!response.ok)
    throw new Error(`TV GenerateIT returned ${response.status}`);
  const [token, ttlSeconds] = (await response.json()) as [unknown, unknown];
  if (typeof token !== "string")
    throw new Error("TV GenerateIT returned no integrity token");
  return {
    token,
    ...(typeof ttlSeconds === "number" ? { ttlSeconds } : {}),
  };
}

async function createSession(): Promise<CachedSession> {
  const [page, config] = await Promise.all([
    fetchText("/tv"),
    fetchText("/tv_config?action_get_config=true&client=lb4&theme=cl"),
  ]);
  const livingRoomPoTokenId = capture(
    page,
    /"LIVING_ROOM_PO_TOKEN_ID":"(.*?)"/,
    "living room id",
  );
  const { requestKey, challenge } = readTvChallenge(config);
  const entry: MinterEntry = await createMinter(challenge, (response) =>
    generateTvIntegrityToken(requestKey, response),
  );
  const session: TvSession = {
    poToken: await entry.minter.mintAsWebsafeString(livingRoomPoTokenId),
    livingRoomPoTokenId,
    visitorData: capture(page, /"visitorData":"(.*?)"/, "visitor data"),
    clientVersion: capture(
      page,
      /"INNERTUBE_CLIENT_VERSION":"(.*?)"/,
      "client version",
    ),
    playerId: capture(page, /\/s\/player\/([\w-]+)\//, "player id"),
  };
  return { session, expiresAt: entry.expiresAt };
}

export async function getTvSession(): Promise<TvSession> {
  if (cached && Date.now() < cached.expiresAt) return cached.session;
  pending ??= createSession()
    .then((next) => {
      cached = next;
      return next;
    })
    .finally(() => {
      pending = null;
    });
  return (await pending).session;
}
