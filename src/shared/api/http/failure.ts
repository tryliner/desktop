import { telemetry } from "@/shared/telemetry";
import {
  isConnectivityFailure,
  isPlaybackPath,
  recordConnectivityFailure,
  statusOf,
  stripQuery,
} from "@/features/connectivity";
import { ApiError } from "../apiError";
import { notifyServerError } from "./notify";

export interface RequestTrace {
  method: string;
  path: string;
  startTime: number;
}

export function elapsedMs(trace: RequestTrace): number {
  return Math.round(performance.now() - trace.startTime);
}

export function recordFailure(
  trace: RequestTrace,
  status: number,
  code?: string,
): void {
  recordConnectivityFailure({
    method: trace.method,
    path: stripQuery(trace.path),
    status,
    ...(code ? { code } : {}),
    latencyMs: elapsedMs(trace),
  });
}

export function recordFetchFailure(trace: RequestTrace, err: unknown): void {
  telemetry.trackNetwork(trace.method, trace.path, 0, elapsedMs(trace));
  if (isConnectivityFailure(err) && !isPlaybackPath(trace.path)) {
    recordFailure(trace, statusOf(err) ?? 0);
  }
}

export function requestIdOf(res: Response): string | undefined {
  return res.headers?.get?.("x-request-id") ?? undefined;
}

export async function errorFromResponse(
  trace: RequestTrace,
  res: Response,
): Promise<ApiError> {
  const requestId = requestIdOf(res);
  const body: unknown = await res.json().catch(() => ({}));
  const fields = new Map<string, unknown>(
    body && typeof body === "object" ? Object.entries(body) : [],
  );
  const message = fields.get("message");
  const code = fields.get("code");
  if (res.status >= 500) notifyServerError(res.status, requestId);
  const error = new ApiError(
    res.status,
    typeof message === "string" ? message : res.statusText,
    typeof code === "string" ? code : undefined,
    requestId,
    fields.get("details"),
  );
  if (isConnectivityFailure(error) && !isPlaybackPath(trace.path)) {
    recordFailure(trace, res.status, error.code);
  }
  return error;
}
