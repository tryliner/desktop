import { getAuthSession, getValidAccessToken } from "../api/auth-session";
import { getApiBaseUrl } from "../api/baseUrl";
import { APP_VERSION } from "../config/version";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 15_000;
const MAX_INTERVAL_MS = 300_000;
const MIN_GAP_MS = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;

function getPlatform(): string {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "desktop";
}

export class PresenceClient {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private inFlight = false;
  private lastBeatAt = 0;

  constructor(private intervalMs = DEFAULT_INTERVAL_MS) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    if (typeof window !== "undefined") {
      window.addEventListener("auth:changed", this.handleWake);
      window.addEventListener("online", this.handleWake);
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    this.schedule();
    void this.beat();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("auth:changed", this.handleWake);
      window.removeEventListener("online", this.handleWake);
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  private handleWake = (): void => {
    if (Date.now() - this.lastBeatAt >= MIN_GAP_MS) void this.beat();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") this.handleWake();
  };

  private schedule(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.beat(), this.intervalMs);
  }

  async beat(): Promise<void> {
    if (!this.isRunning || this.inFlight) return;
    const session = getAuthSession();
    if (!session?.accessToken) return;

    this.inFlight = true;
    this.lastBeatAt = Date.now();
    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken || !this.isRunning) return;

      const res = await fetch(`${getApiBaseUrl()}/v1/presence/heartbeat`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          username: session.user?.username,
          email: session.user?.email,
          displayName: session.user?.displayName,
          clientVersion: APP_VERSION,
          platform: getPlatform(),
        }),
        keepalive: true,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const suggested = Number(res.headers.get("x-liner-heartbeat-interval")) * 1000;
      if (Number.isFinite(suggested) && suggested >= MIN_INTERVAL_MS && suggested <= MAX_INTERVAL_MS && suggested !== this.intervalMs) {
        this.intervalMs = suggested;
        if (this.isRunning) this.schedule();
      }
    } catch {
      // offline or server unreachable
    } finally {
      this.inFlight = false;
    }
  }

  getIntervalMs(): number {
    return this.intervalMs;
  }
}

export const presenceClient = new PresenceClient();
