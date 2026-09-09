import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  telemetry,
  telemetryConfig,
  setTelemetryEnabled,
  isTelemetryEnabled,
} from "./index";

describe("Liner Desktop Telemetry Module", () => {
  beforeEach(() => {
    setTelemetryEnabled(true);
    vi.restoreAllMocks();
  });

  it("allows easily toggling telemetry on and off", () => {
    expect(isTelemetryEnabled()).toBe(true);
    setTelemetryEnabled(false);
    expect(isTelemetryEnabled()).toBe(false);
    setTelemetryEnabled(true);
    expect(isTelemetryEnabled()).toBe(true);
  });

  it("records and reports errors with sanitized payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    globalThis.fetch = fetchMock;

    await telemetry.reportError(new Error("Audio stream decode failure"), {
      trackId: "track-777",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(telemetryConfig.errorUrl);
    expect(options.method).toBe("POST");

    const sentBody = JSON.parse(options.body);
    expect(sentBody.message).toBe("Audio stream decode failure");
    expect(sentBody.context.trackId).toBe("track-777");
    expect(sentBody.breadcrumbs).toBeUndefined();
  });

  it("batches and flushes network and playback health events correctly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    globalThis.fetch = fetchMock;

    telemetry.trackPlaybackHealth("INIT_LATENCY", {
      trackId: "track-1",
      audioStartLatencyMs: 120,
    });
    telemetry.trackNetwork("GET", "/v1/tracks/1", 200, 35);

    await telemetry.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(telemetryConfig.ingestUrl);

    const sentBody = JSON.parse(options.body);
    expect(sentBody.events.length).toBe(2);
    expect(sentBody.events[0].actionName).toBe("INIT_LATENCY");
    expect(sentBody.events[0].source).toBe("playback");
    expect(sentBody.events[1].source).toBe("client-net");
    expect(sentBody.events[1].durationMs).toBe(35);
  });
});

