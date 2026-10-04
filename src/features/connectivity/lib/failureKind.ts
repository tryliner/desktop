const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function statusOf(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function isConnectivityFailure(err: unknown): boolean {
  const status = statusOf(err);
  return status === 0 || (status !== undefined && GATEWAY_STATUSES.has(status));
}

export function stripQuery(path: string): string {
  const cut = path.indexOf("?");
  return cut === -1 ? path : path.slice(0, cut);
}

export function isPlaybackPath(path: string): boolean {
  const stripped = stripQuery(path);
  return (
    /^\/v1\/tracks\/[^/]+\/(?:playback|lyrics)(?:\/|$)/.test(stripped) ||
    /^\/v1\/playback(?:\/|$)/.test(stripped)
  );
}
