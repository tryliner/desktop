import { telemetry } from "./telemetryClient";

let isInitialized = false;

/**
 * Initialize client telemetry and global error listeners.
 */
export function initTelemetry(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // 1. Uncaught Javascript exceptions
  window.addEventListener("error", (event) => {
    telemetry.reportError(event.error || event.message, {
      source: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // 2. Unhandled Promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    telemetry.reportError(event.reason || "Unhandled Promise Rejection", {
      source: "window.unhandledrejection",
    });
  });
}
