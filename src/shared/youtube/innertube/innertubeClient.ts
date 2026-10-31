import {
  getClientVisitorData,
  resetClientVisitorData,
} from "../session/visitorSession";
import {
  getYoutubeAuthorization,
  getYoutubePageId,
} from "../auth/youtubeAuthSession";
import { USER_AGENT_HEADER_OVERRIDE } from "./userAgentOverride";

export type InnertubeEndpoint =
  "search" | "browse" | "next" | "player" | "account/accounts_list";

export interface InnertubeProfile {
  clientName: string;
  clientVersion: string;
  clientIdHeader: string;
  origin: string;
  userAgent?: string;
  includeUserAgentInContext?: boolean;
  requiresJsPlayer?: boolean;
  acceptsOAuth?: boolean;
  extraContext?: Record<string, string | number>;
}

export const WEB_REMIX_PROFILE: InnertubeProfile = {
  clientName: "WEB_REMIX",
  clientVersion: "1.20260911.08.00",
  clientIdHeader: "67",
  origin: "https://music.youtube.com",
};

export { USER_AGENT_HEADER_OVERRIDE };

const SESSION_REJECTED = new Set([401, 403]);
const INNERTUBE_TIMEOUT_MS = 12_000;

export class InnertubeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "InnertubeError";
  }
}

export interface InnertubeRequestOptions {
  profile?: InnertubeProfile;
  signal?: AbortSignal;
}

function buildClientContext(
  profile: InnertubeProfile,
  visitorData: string,
): Record<string, unknown> {
  return {
    clientName: profile.clientName,
    clientVersion: profile.clientVersion,
    hl: "en",
    gl: "US",
    ...(visitorData ? { visitorData } : {}),
    ...(profile.includeUserAgentInContext && profile.userAgent
      ? { userAgent: profile.userAgent }
      : {}),
    ...profile.extraContext,
  };
}

export function buildUserContext(
  authorization: string | null,
): Record<string, unknown> {
  const pageId = authorization ? getYoutubePageId() : null;
  return {
    lockedSafetyMode: false,
    ...(pageId ? { onBehalfOfUser: pageId } : {}),
  };
}

function buildHeaders(
  profile: InnertubeProfile,
  visitorData: string,
  authorization: string | null,
): Record<string, string> {
  return {
    ...(authorization ? { authorization } : {}),
    "content-type": "application/json",
    accept: "application/json",
    "x-youtube-client-name": profile.clientIdHeader,
    "x-youtube-client-version": profile.clientVersion,
    "x-origin": profile.origin,
    ...(visitorData ? { "x-goog-visitor-id": visitorData } : {}),
    ...(profile.userAgent
      ? { [USER_AGENT_HEADER_OVERRIDE]: profile.userAgent }
      : {}),
  };
}

export async function postInnertube(
  endpoint: InnertubeEndpoint,
  body: Record<string, unknown>,
  options: InnertubeRequestOptions = {},
): Promise<unknown> {
  const profile = options.profile ?? WEB_REMIX_PROFILE;
  const authorization = profile.acceptsOAuth
    ? await getYoutubeAuthorization(options.signal).catch(() => null)
    : null;
  const url = `${profile.origin}/youtubei/v1/${endpoint}?prettyPrint=false`;

  const send = async (): Promise<Response> => {
    const visitorData = await getClientVisitorData().catch(() => "");
    const payload = {
      ...body,
      context: {
        client: buildClientContext(profile, visitorData),
        user: buildUserContext(authorization),
      },
    };
    try {
      return await fetch(url, {
        method: "POST",
        headers: buildHeaders(profile, visitorData, authorization),
        body: JSON.stringify(payload),
        signal: options.signal
          ? AbortSignal.any([
              options.signal,
              AbortSignal.timeout(INNERTUBE_TIMEOUT_MS),
            ])
          : AbortSignal.timeout(INNERTUBE_TIMEOUT_MS),
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new InnertubeError("YouTube Music is unreachable.", 0);
    }
  };

  let response = await send();
  if (SESSION_REJECTED.has(response.status)) {
    resetClientVisitorData();
    response = await send();
  }

  if (!response.ok) {
    throw new InnertubeError(
      `YouTube Music ${endpoint} failed with HTTP ${response.status}.`,
      response.status,
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new InnertubeError(
      `YouTube Music ${endpoint} returned invalid JSON.`,
      502,
    );
  }
}
