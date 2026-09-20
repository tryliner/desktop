import { getAuthSession, getValidAccessToken } from "../api/auth-session";
import { getApiBaseUrl, switchToFallbackEdge } from "../api/baseUrl";
import { APP_VERSION } from "../config/version";

const DEFAULT_PING_INTERVAL_MS = 25_000;
const INITIAL_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

function getPlatform(): string {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "desktop";
}

function getWsEndpointUrl(): string {
  const apiBase = getApiBaseUrl();
  const wsProtocol = apiBase.startsWith("https") ? "wss:" : "ws:";
  const host = apiBase.replace(/^https?:\/\//, "");
  return `${wsProtocol}//${host}/v1/ping/ws`;
}

export class PresenceClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private isRunning = false;
  private isDestroyed = false;

  constructor(private readonly pingIntervalMs = DEFAULT_PING_INTERVAL_MS) {}

  // starts presence background lifecycle and registers system listeners
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isDestroyed = false;

    if (typeof window !== "undefined") {
      window.addEventListener("auth:changed", this.handleAuthChanged);
      window.addEventListener("online", this.handleOnline);
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    void this.connect();
  }

  // stops presence client and tears down active socket and timers
  stop(): void {
    this.isRunning = false;
    this.clearTimers();
    this.disconnectSocket();

    if (typeof window !== "undefined") {
      window.removeEventListener("auth:changed", this.handleAuthChanged);
      window.removeEventListener("online", this.handleOnline);
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  private handleAuthChanged = (): void => {
    const session = getAuthSession();
    if (!session?.accessToken) {
      this.disconnectSocket();
      this.clearTimers();
    } else if (this.isRunning && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      void this.connect();
    }
  };

  private handleOnline = (): void => {
    if (this.isRunning && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      void this.connect();
    }
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible" && this.isRunning) {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        void this.connect();
      }
    }
  };

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private disconnectSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  // establishes websocket connection and sends initial auth payload
  async connect(): Promise<void> {
    if (!this.isRunning || typeof window === "undefined" || typeof WebSocket === "undefined") {
      return;
    }

    // verify we have an active session
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return;
    }

    this.disconnectSocket();
    this.clearTimers();

    const wsUrl = getWsEndpointUrl();

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

        const session = getAuthSession();
        const initPayload = {
          token: accessToken,
          userId: session?.user?.id,
          username: session?.user?.username,
          email: session?.user?.email,
          clientVersion: APP_VERSION,
          platform: getPlatform(),
        };

        try {
          ws.send(JSON.stringify(initPayload));
        } catch {
          this.scheduleReconnect();
          return;
        }

        // start periodic 1-byte ping heartbeat
        this.pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send("p");
            } catch {
              this.scheduleReconnect();
            }
          }
        }, this.pingIntervalMs);
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.clearTimers();
        this.ws = null;
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        if (this.ws !== ws) return;
        // try failover edge if cloudflare blocks websocket in russia
        switchToFallbackEdge();
        this.clearTimers();
        this.disconnectSocket();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || this.reconnectTimer) return;
    const session = getAuthSession();
    if (!session?.accessToken) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, MAX_RECONNECT_DELAY_MS);
      void this.connect();
    }, this.reconnectDelay);
  }

  // exposed for testing
  getSocketState(): number | null {
    return this.ws ? this.ws.readyState : null;
  }
}

export const presenceClient = new PresenceClient();
