// connection failures: nothing reached the server (status 0 covers dns,
// tcp refused, timeouts) or a gateway/proxy in between failed (502/503/504).
// 4xx and plain 500s are app errors, tripping the offline wall on those
// would strand users who are actually online.
const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function statusOf(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function isConnectivityFailure(err: unknown): boolean {
  const status = statusOf(err);
  return status === 0 || (status !== undefined && GATEWAY_STATUSES.has(status));
}

// failure paths may carry query ids, the wall only needs the route
export function stripQuery(path: string): string {
  const cut = path.indexOf("?");
  return cut === -1 ? path : path.slice(0, cut);
}
