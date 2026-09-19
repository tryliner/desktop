/**
 * Client Telemetry & Metrics Configuration for Liner Desktop.
 * Easily toggled via environment variables or runtime switch.
 */

export interface TelemetryConfig {
  /** Master switch for client telemetry and crash reporting */
  enabled: boolean;
  /** Ingestion endpoint for batch UI actions, network stats, and performance events */
  ingestUrl: string;
  /** Ingestion endpoint for uncaught exceptions and crashes */
  errorUrl: string;
  /** Max items before flushing queue immediately */
  batchSize: number;
  /** Periodic flush interval in milliseconds */
  flushIntervalMs: number;
}

const DEFAULT_INGEST_URL =
  (import.meta.env.VITE_MONITOR_INGEST_URL as string | undefined) ||
  "https://monitor.tryliner.fun/v1/ingest";

const DEFAULT_ERROR_URL =
  (import.meta.env.VITE_MONITOR_ERROR_URL as string | undefined) ||
  "https://monitor.tryliner.fun/v1/client/error";

const STORAGE_KEY = "liner_telemetry_opt_in";

function getInitialOptIn(): boolean {
  return false;
}

let isEnabled = false;

export const telemetryConfig: TelemetryConfig = {
  get enabled() {
    return isEnabled;
  },
  set enabled(val: boolean) {
    isEnabled = val;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(val));
      }
    } catch {}
  },
  ingestUrl: DEFAULT_INGEST_URL,
  errorUrl: DEFAULT_ERROR_URL,
  batchSize: 10,
  flushIntervalMs: 3000,
};

/**
 * Convenient 1-line runtime switch to toggle client telemetry.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  telemetryConfig.enabled = enabled;
}

export function isTelemetryEnabled(): boolean {
  return telemetryConfig.enabled;
}

