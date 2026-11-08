import { getAuthSession } from "./auth-session";

export interface EdgeKeyAnswer {
  key: string;
  rotatesAt: string;
}

type FetchEdgeKey = () => Promise<EdgeKeyAnswer>;

const MIN_DELAY_MS = 60_000;
const MAX_DELAY_MS = 10 * 60_000;
const EARLY_MS = 2 * 60_000;
const RETRY_MS = 10 * 60_000;

let fetcher: FetchEdgeKey | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<boolean> | null = null;
let held: string | null = null;

function hand(key: string | null): void {
  held = key;
  if (typeof window !== "undefined") window.linerElectron?.setEdgeKey?.(key);
}

function schedule(delayMs: number): void {
  if (timer) clearTimeout(timer);
  const bounded = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, delayMs));
  timer = setTimeout(() => void refreshEdgeKey(), bounded);
}

export function nextRefreshDelay(rotatesAt: string, now = Date.now()): number {
  const at = Date.parse(rotatesAt);
  if (Number.isNaN(at)) return RETRY_MS;
  return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, at - now - EARLY_MS));
}

export function refreshEdgeKey(): Promise<boolean> {
  if (!fetcher || !getAuthSession()) {
    if (timer) clearTimeout(timer);
    timer = null;
    hand(null);
    return Promise.resolve(false);
  }
  if (inFlight) return inFlight;
  const load = fetcher;
  inFlight = load()
    .then((answer) => {
      hand(answer.key);
      schedule(nextRefreshDelay(answer.rotatesAt));
      return true;
    })
    .catch(() => {
      schedule(RETRY_MS);
      return false;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function heldEdgeKey(): string | null {
  return held;
}

export function initEdgeKey(fetchEdgeKey: FetchEdgeKey): () => void {
  fetcher = fetchEdgeKey;
  const onAuthChange = () => void refreshEdgeKey();
  window.addEventListener("auth:changed", onAuthChange);
  void refreshEdgeKey();
  return () => {
    window.removeEventListener("auth:changed", onAuthChange);
    if (timer) clearTimeout(timer);
    timer = null;
    fetcher = null;
    hand(null);
  };
}
