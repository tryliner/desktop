import type { Session } from "electron";

export const EDGE_HOSTS = [
  "api.tryliner.fun",
  "beta.tryliner.fun",
  "staging.tryliner.fun",
];

export const EDGE_REQUEST_URLS = EDGE_HOSTS.map((host) => `*://${host}/*`);

const EDGE_KEY_HEADER = "x-liner-edge";
const CLEARANCE_COOKIE = "cf_clearance";
const EDGE_KEY_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;
const CLEARANCE_SHAPE = /^[A-Za-z0-9._-]{16,2048}$/;

export interface EdgeState {
  key: string | null;
  clearance: string | null;
}

const state: EdgeState = { key: null, clearance: null };

export function isEdgeUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && EDGE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

export function setEdgeKey(key: unknown): void {
  state.key = typeof key === "string" && EDGE_KEY_SHAPE.test(key) ? key : null;
}

export function setClearance(value: unknown): void {
  state.clearance =
    typeof value === "string" && CLEARANCE_SHAPE.test(value) ? value : null;
}

function headerName(
  headers: Record<string, string>,
  wanted: string,
): string | undefined {
  return Object.keys(headers).find((name) => name.toLowerCase() === wanted);
}

export function withEdgeHeaders(
  headers: Record<string, string>,
  current: EdgeState = state,
): Record<string, string> {
  const next = { ...headers };
  if (current.key && !headerName(next, EDGE_KEY_HEADER)) {
    next[EDGE_KEY_HEADER] = current.key;
  }
  if (current.clearance) {
    const cookieName = headerName(next, "cookie");
    const pair = `${CLEARANCE_COOKIE}=${current.clearance}`;
    const others = (cookieName ? next[cookieName] : "")
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part && part !== pair);
    if (cookieName) delete next[cookieName];
    next.Cookie = [pair, ...others].join("; ");
  }
  return next;
}

function isZoneCookie(domain: string | undefined): boolean {
  const bare = (domain ?? "").replace(/^\./, "");
  return bare === "tryliner.fun" || EDGE_HOSTS.includes(bare);
}

export function watchClearance(session: Session): void {
  const load = () =>
    session.cookies
      .get({ name: CLEARANCE_COOKIE })
      .then((cookies) => {
        const fresh = cookies
          .filter((cookie) => isZoneCookie(cookie.domain))
          .filter(
            (cookie) =>
              !cookie.expirationDate ||
              cookie.expirationDate * 1000 > Date.now(),
          )
          .sort((a, b) => (b.expirationDate ?? 0) - (a.expirationDate ?? 0))[0];
        setClearance(fresh?.value ?? null);
      })
      .catch(() => setClearance(null));
  void load();
  session.cookies.on("changed", (_event, cookie, _cause, removed) => {
    if (cookie.name !== CLEARANCE_COOKIE || !isZoneCookie(cookie.domain)) return;
    if (removed) void load();
    else setClearance(cookie.value);
  });
}
