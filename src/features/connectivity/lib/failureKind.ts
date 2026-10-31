const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function statusOf(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function isConnectivityFailure(err: unknown): boolean {
  const status = statusOf(err);
  return status === 0 || (status !== undefined && GATEWAY_STATUSES.has(status));
}

// the api health check got an http 5xx back: liner's servers are down, the user's connection works
export function isServerOutage(
  checks: { id: string; detail?: string }[],
): boolean {
  return checks.some(
    (c) => c.id === "api" && /^HTTP 5\d\d$/.test(c.detail ?? ""),
  );
}

export function stripQuery(path: string): string {
  const cut = path.indexOf("?");
  return cut === -1 ? path : path.slice(0, cut);
}

export function isPlaybackPath(path: string): boolean {
  return /^\/v1\/tracks\/[^/]+\/(?:playback|lyrics)(?:\/|$)/.test(
    stripQuery(path),
  );
}
