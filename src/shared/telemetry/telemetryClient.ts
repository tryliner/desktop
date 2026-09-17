import { telemetryConfig } from "./config";
import { getAuthSession } from "../api/auth-session";
import { syncServerTime } from "../api/requestSigner";

export interface TelemetryEventDetails {
  url?: string;
  method?: string;
  clientIp?: string;
  userAgent?: string;
  queryParams?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  stackTrace?: string;
  context?: Record<string, unknown>;
  errorDetails?: {
    name?: string;
    message: string;
    code?: string;
  };
}

export interface ClientTelemetryEvent {
  id?: string;
  requestId?: string;
  traceId?: string;
  userId?: string;
  sessionId?: string;
  clientVersion?: string;
  platform?: string;
  title: string;
  summary?: string;
  source?: "client-net" | "error" | "playback" | "client-ui";
  category?: "network" | "error" | "playback" | "ui";
  level?: "info" | "warn" | "error" | "success";
  actionName?: string;
  statusCode?: number;
  durationMs?: number;
  details?: TelemetryEventDetails;
}

function sanitizeString(str: string): string {
  if (!str) return str;
  return str
    // Strip Windows and Unix local user paths
    .replace(/[a-zA-Z]:\\[Uu]sers\\[^\s\\/]+/g, "C:\\Users\\[User]")
    .replace(/(?:\/home\/|\/Users\/)[^\s\/]+/g, "/home/[user]")
    // Strip sensitive bearer tokens or keys
    .replace(/(?:Bearer\s+|token=)[a-zA-Z0-9._-]+/gi, "$1[Redacted]")
    .replace(/(?:password|secret|key)=[^&\s]+/gi, "$1=[Redacted]");
}

function sanitizeData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") return sanitizeString(data) as unknown as T;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("authorization")
    ) {
      result[k] = "[Redacted]";
    } else {
      result[k] = sanitizeData(v);
    }
  }
  return result as T;
}

export function getClientEnvironment() {
  const hasWebGL = typeof window !== "undefined" && Boolean(
    window.WebGLRenderingContext &&
    (() => {
      try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
      } catch {
        return false;
      }
    })(),
  );

  return {
    platform: typeof navigator !== "undefined" ? navigator.platform || "desktop" : "desktop",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    webglEnabled: hasWebGL,
    language: typeof navigator !== "undefined" ? navigator.language : "en",
    hardwareConcurrency: typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined,
    deviceMemory: typeof navigator !== "undefined" ? (navigator as any).deviceMemory : undefined,
  };
}

class TelemetryClient {
  private queue: ClientTelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private backoffUntil = 0;

  constructor() {
    this.startPeriodicFlush();
  }

  private startPeriodicFlush(): void {
    if (typeof window === "undefined") return;
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, telemetryConfig.flushIntervalMs);

    window.addEventListener("beforeunload", () => {
      this.flushSync();
    });
  }

  /**
   * Track a client-side event.
   */
  public trackEvent(event: ClientTelemetryEvent): void {
    if (!telemetryConfig.enabled) return;

    const authSession = getAuthSession();
    const userId = event.userId || authSession?.user?.id || undefined;

    const sanitizedEvent: ClientTelemetryEvent = {
      ...event,
      userId,
      title: sanitizeString(event.title),
      summary: event.summary ? sanitizeString(event.summary) : undefined,
      source: event.source ?? "playback",
      category: event.category ?? "playback",
      details: {
        ...(event.details ? sanitizeData(event.details) : {}),
        ...(userId ? { userId } : {}),
      },
    };

    this.queue.push(sanitizedEvent);

    if (this.queue.length >= telemetryConfig.batchSize && Date.now() >= this.backoffUntil) {
      this.flush().catch(() => {});
    }
  }

  /**
   * Track Playback Health event (STALL_BUFFERING, MEDIA_DECODE_ERROR, Audio Latency).
   */
  public trackPlaybackHealth(
    eventType: "MEDIA_DECODE_ERROR" | "STALL_BUFFERING" | "INIT_LATENCY",
    data: {
      trackId?: string;
      codec?: string;
      bitrate?: number;
      stallDurationMs?: number;
      timeToFirstByteMs?: number;
      audioStartLatencyMs?: number;
      errorMessage?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    const isError = eventType === "MEDIA_DECODE_ERROR";
    const title = `Playback Health: ${eventType}${data.trackId ? ` (${data.trackId})` : ""}`;
    const summary = isError
      ? `Decode failure: ${data.errorMessage || "Unsupported audio codec"}`
      : eventType === "STALL_BUFFERING"
        ? `Playback stalled for ${data.stallDurationMs ?? 0}ms`
        : `Audio engine initialized in ${data.audioStartLatencyMs ?? 0}ms (TTFB: ${data.timeToFirstByteMs ?? 0}ms)`;

    this.trackEvent({
      title,
      summary,
      actionName: eventType,
      source: isError ? "error" : "playback",
      category: isError ? "error" : "playback",
      level: isError ? "error" : eventType === "STALL_BUFFERING" ? "warn" : "info",
      details: {
        context: {
          ...sanitizeData(data),
          environment: getClientEnvironment(),
        },
      },
    });
  }

  /**
   * Track a client-side network request to the Liner API.
   */
  public trackNetwork(
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
    requestId?: string,
    details?: Partial<TelemetryEventDetails>,
  ): void {
    const isError = statusCode >= 400;

    this.trackEvent({
      requestId,
      title: `${method.toUpperCase()} ${url} (${statusCode})`,
      summary: `${method.toUpperCase()} request finished in ${durationMs}ms`,
      source: "client-net",
      category: "network",
      level: isError ? (statusCode >= 500 ? "error" : "warn") : "info",
      statusCode,
      durationMs,
      details: {
        url,
        method,
        ...sanitizeData(details || {}),
      },
    });
  }

  public async reportError(
    error: Error | string | unknown,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const isDevEnv =
      Boolean(import.meta.env.DEV) ||
      (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.port === "5173" ||
          window.location.protocol === "http:"));
    if (isDevEnv && import.meta.env.MODE !== "test") return;

    if (!telemetryConfig.enabled || Date.now() < this.backoffUntil) return;

    const errorObj =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown client error");

    const rawStack = errorObj.stack || "";
    const sanitizedStack = sanitizeString(rawStack);
    const sanitizedMessage = sanitizeString(errorObj.message);

    const env = getClientEnvironment();
    const authSession = getAuthSession();
    const userId = authSession?.user?.id || undefined;

    const payload = {
      userId,
      title: sanitizeString(errorObj.name || "Client Error"),
      message: sanitizedMessage,
      stack: sanitizedStack,
      statusCode: 500,
      context: {
        ...(userId ? { userId } : {}),
        ...sanitizeData(context || {}),
        environment: env,
      },
      url: typeof window !== "undefined" ? window.location.href : undefined,
    };

    const bodyStr = JSON.stringify(payload);

    try {
      let headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Sign with dedicated Monitor HMAC Key via Electron native signer if available
      if (typeof window !== "undefined" && window.linerElectron?.signMonitorRequest) {
        const signed = await window.linerElectron.signMonitorRequest({
          method: "POST",
          path: "/v1/client/error",
          body: bodyStr,
        });

        if (signed && signed.signature && signed.nonce) {
          headers = {
            ...headers,
            "x-liner-signature": signed.signature,
            "x-liner-timestamp": String(signed.timestamp),
            "x-liner-nonce": signed.nonce,
          };
        }
      }

      const res = await fetch(telemetryConfig.errorUrl, {
        method: "POST",
        headers,
        body: bodyStr,
      });

      const dateHeader = res.headers?.get?.("date");
      if (dateHeader) {
        syncServerTime(dateHeader);
      }

      if (!res.ok && (res.status === 429 || res.status === 403)) {
        this.backoffUntil = Date.now() + 30000;
      }
    } catch {
      // Fail silently to never break the application UI
    }
  }

  /**
   * Flush queued events in background with HMAC signature.
   */
  public async flush(): Promise<void> {
    if (!telemetryConfig.enabled || this.queue.length === 0 || this.isFlushing) {
      return;
    }

    if (Date.now() < this.backoffUntil) {
      return;
    }

    this.isFlushing = true;
    const batch = this.queue.splice(0, telemetryConfig.batchSize);

    try {
      const payload = { events: batch };
      const bodyStr = JSON.stringify(payload);

      let headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Sign batch using Monitor HMAC secret via native signer
      if (typeof window !== "undefined" && window.linerElectron?.signMonitorRequest) {
        const signed = await window.linerElectron.signMonitorRequest({
          method: "POST",
          path: "/v1/ingest",
          body: bodyStr,
        });

        if (signed && signed.signature && signed.nonce) {
          headers = {
            ...headers,
            "x-liner-signature": signed.signature,
            "x-liner-timestamp": String(signed.timestamp),
            "x-liner-nonce": signed.nonce,
          };
        }
      }

      const res = await fetch(telemetryConfig.ingestUrl, {
        method: "POST",
        headers,
        body: bodyStr,
      });

      const dateHeader = res.headers?.get?.("date");
      if (dateHeader) {
        syncServerTime(dateHeader);
      }

      if (!res.ok) {
        if (res.status === 429 || res.status === 403 || res.status >= 500) {
          this.backoffUntil = Date.now() + 30000;
        }
        // Do NOT re-queue 401/403 authorization rejects to prevent infinite loop
        if (res.status !== 401 && res.status !== 403 && this.queue.length < 50) {
          this.queue.unshift(...batch);
        }
      } else {
        this.backoffUntil = 0;
      }
    } catch {
      this.backoffUntil = Date.now() + 10000;
      if (this.queue.length < 50) {
        this.queue.unshift(...batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Synchronous flush for window unload.
   */
  private flushSync(): void {
    if (!telemetryConfig.enabled || this.queue.length === 0) return;
    const batch = this.queue.splice(0, telemetryConfig.batchSize);
    try {
      const payload = JSON.stringify({ events: batch });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(telemetryConfig.ingestUrl, blob);
      }
    } catch {}
  }

  public destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.queue = [];
  }
}

export const telemetry = new TelemetryClient();
