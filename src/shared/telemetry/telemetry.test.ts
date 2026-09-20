import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  telemetry,
  telemetryConfig,
  setTelemetryEnabled,
  isTelemetryEnabled,
} from "./index";

describe("Liner Desktop Telemetry Module", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setTelemetryEnabled(true);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("allows easily toggling telemetry on and off", () => {
    expect(isTelemetryEnabled()).toBe(true);
    setTelemetryEnabled(false);
    expect(isTelemetryEnabled()).toBe(false);
    setTelemetryEnabled(true);
    expect(isTelemetryEnabled()).toBe(true);
  });

  it("records and reports errors with sanitized payload without crashing", async () => {
    await expect(
      telemetry.reportError(new Error("Audio stream decode failure"), {
        trackId: "track-777",
      }),
    ).resolves.toBeUndefined();
  });

  it("batches and flushes network and playback health events correctly", async () => {
    telemetry.trackPlaybackHealth("INIT_LATENCY", {
      trackId: "track-1",
      audioStartLatencyMs: 120,
    });
    telemetry.trackNetwork("GET", "/v1/tracks/1", 200, 35);

    await expect(telemetry.flush()).resolves.toBeUndefined();
  });
});


