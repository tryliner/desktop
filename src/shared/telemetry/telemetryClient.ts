import { telemetryConfig } from "./config";

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

export function getClientEnvironment() {
  return {
    platform:
      typeof navigator !== "undefined"
        ? navigator.platform || "desktop"
        : "desktop",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    webglEnabled: false,
    language: typeof navigator !== "undefined" ? navigator.language : "en",
    hardwareConcurrency:
      typeof navigator !== "undefined"
        ? navigator.hardwareConcurrency
        : undefined,
    deviceMemory:
      typeof navigator !== "undefined"
        ? (navigator as any).deviceMemory
        : undefined,
  };
}

class TelemetryClient {
  constructor() {}

  public trackEvent(_event: ClientTelemetryEvent): void {}

  public trackPlaybackHealth(
    _eventType: "MEDIA_DECODE_ERROR" | "STALL_BUFFERING" | "INIT_LATENCY",
    _data: {
      trackId?: string;
      codec?: string;
      bitrate?: number;
      stallDurationMs?: number;
      timeToFirstByteMs?: number;
      audioStartLatencyMs?: number;
      errorMessage?: string;
      details?: Record<string, unknown>;
    },
  ): void {}

  public trackNetwork(
    _method: string,
    _url: string,
    _statusCode: number,
    _durationMs: number,
    _requestId?: string,
    _details?: Partial<TelemetryEventDetails>,
  ): void {}

  public async reportError(
    _error: Error | string | unknown,
    _context?: Record<string, unknown>,
  ): Promise<void> {}

  public async flush(): Promise<void> {}

  public destroy(): void {}
}

export const telemetry = new TelemetryClient();
