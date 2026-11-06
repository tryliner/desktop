import {
  getAuthSession,
  getSessionExpiryMs,
  getValidAccessToken,
  refreshAuthSession,
} from "../auth-session";
import { getApiBaseUrl } from "../baseUrl";
import { signApiRequest, syncServerTime } from "../requestSigner";
import { telemetry } from "@/shared/telemetry";
import { ApiError } from "../apiError";
import { DEFAULT_TIMEOUT_MS, fetchWithTimeout } from "./fetchWithTimeout";
import {
  errorFromResponse,
  elapsedMs,
  recordFailure,
  recordFetchFailure,
  requestIdOf,
  type RequestTrace,
} from "./failure";

export interface RequestInput {
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  allowRefresh?: boolean;
  timeoutMs?: number;
  /** "include" sends the cloudflare edge cookie on auth calls */
  credentials?: RequestCredentials;
  onResponse?: (res: Response) => void;
}

function isAuthPath(path: string): boolean {
  return path.startsWith("/v1/auth/");
}

function isAbort(input: RequestInput, err: unknown): boolean {
  return (
    Boolean(input.signal?.aborted) ||
    (err instanceof Error && err.name === "AbortError")
  );
}

async function startToken(
  input: RequestInput,
  trace: RequestTrace,
): Promise<string | null> {
  if (input.allowRefresh === false) return null;
  const session = getAuthSession();
  const token = await getValidAccessToken();
  if (token || !session?.accessToken || isAuthPath(input.path)) return token;
  const expiryMs = getSessionExpiryMs(session);
  if (expiryMs && expiryMs > Date.now()) return session.accessToken;
  recordFailure(trace, 0);
  throw new ApiError(0, "Network error during token refresh.", "NETWORK_ERROR");
}

async function retryToken(usedToken: string | null): Promise<string | null> {
  const session = getAuthSession();
  if (session?.accessToken && session.accessToken !== usedToken) {
    return session.accessToken;
  }
  if (!session?.refreshToken) return null;
  const refreshed = await refreshAuthSession();
  const next = refreshed?.accessToken ?? null;
  if (!next && getAuthSession()?.refreshToken) {
    throw new ApiError(
      0,
      "Failed to refresh auth session due to network issue",
      "NETWORK_ERROR",
    );
  }
  return next;
}

async function send(
  input: RequestInput,
  trace: RequestTrace,
  token: string | null,
): Promise<Response> {
  const signed = await signApiRequest(
    input.method,
    input.path,
    input.body ?? null,
  );
  const { Authorization: _ignored, ...extra } = input.headers ?? {};
  try {
    const res = await fetchWithTimeout(
      getApiBaseUrl() + input.path,
      {
        method: input.method,
        body: input.body,
        signal: input.signal,
        ...(input.credentials ? { credentials: input.credentials } : {}),
        headers: {
          ...(input.body != null ? { "Content-Type": "application/json" } : {}),
          ...extra,
          ...signed,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const date = res.headers?.get?.("date");
    if (date) syncServerTime(date);
    return res;
  } catch (err) {
    if (isAbort(input, err)) throw err;
    recordFetchFailure(trace, err);
    throw err;
  }
}

export async function executeRequest(input: RequestInput): Promise<unknown> {
  const trace: RequestTrace = {
    method: input.method,
    path: input.path,
    startTime: performance.now(),
  };
  const token = await startToken(input, trace);
  let res = await send(input, trace, token);

  if (
    res.status === 401 &&
    input.allowRefresh !== false &&
    !isAuthPath(input.path)
  ) {
    const next = await retryToken(token);
    if (next) res = await send(input, trace, next);
  }

  const requestId = requestIdOf(res);
  telemetry.trackNetwork(
    trace.method,
    trace.path,
    res.status,
    elapsedMs(trace),
    requestId,
  );
  input.onResponse?.(res);
  if (res.status === 304) return undefined;
  if (!res.ok) throw await errorFromResponse(trace, res);
  if (res.status === 204) return undefined;
  return res.json();
}
