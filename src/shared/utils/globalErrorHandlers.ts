import { log } from "./logger";
import { telemetry } from "@/shared/telemetry";

export interface GlobalErrorHandlerOptions {
  onError?: (event: ErrorEvent) => void;
  onUnhandledRejection?: (event: PromiseRejectionEvent) => void;
}

let isInitialized = false;
let cleanupFn: (() => void) | null = null;

/**
 * Initializes global error and unhandled rejection listeners for the renderer process.
 * Safely captures and logs uncaught exceptions and unhandled promise rejections.
 */
export function initGlobalErrorHandlers(
  options?: GlobalErrorHandlerOptions,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (isInitialized && cleanupFn) {
    return cleanupFn;
  }

  const handleError = (event: ErrorEvent) => {
    const errorObj = event.error;
    const message = event.message || errorObj?.message || "Unknown error";
    const filename = event.filename || "unknown file";
    const lineno = event.lineno || 0;
    const colno = event.colno || 0;

    log(
      "red",
      "UncaughtError",
      `${message} (${filename}:${lineno}:${colno})`,
      errorObj ?? event,
    );

    telemetry.reportError(errorObj ?? message, {
      source: "window.onerror",
      filename,
      lineno,
      colno,
    }).catch(() => {});

    options?.onError?.(event);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : JSON.stringify(reason);

    log(
      "red",
      "UnhandledRejection",
      `Unhandled Promise Rejection: ${message}`,
      reason,
    );

    telemetry.reportError(reason ?? "Unhandled Promise Rejection", {
      source: "window.unhandledrejection",
    }).catch(() => {});

    options?.onUnhandledRejection?.(event);
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  isInitialized = true;

  cleanupFn = () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    isInitialized = false;
    cleanupFn = null;
  };

  return cleanupFn;
}
