import { describe, expect, it } from "vitest";
import {
  isConnectivityFailure,
  isPlaybackPath,
  isServerOutage,
  statusOf,
  stripQuery,
} from "./failureKind";

describe("isServerOutage", () => {
  it("is true only when the api answered with a 5xx", () => {
    expect(
      isServerOutage([
        { id: "device", detail: "online" },
        { id: "api", detail: "HTTP 503" },
      ]),
    ).toBe(true);
    expect(isServerOutage([{ id: "api", detail: "timed out" }])).toBe(false);
    expect(isServerOutage([{ id: "api", detail: "HTTP 401" }])).toBe(false);
    expect(isServerOutage([])).toBe(false);
  });
});

describe("isConnectivityFailure", () => {
  it("treats unreachable server as connectivity failure", () => {
    expect(isConnectivityFailure({ status: 0 })).toBe(true);
  });

  it("treats gateway errors as connectivity failure", () => {
    expect(isConnectivityFailure({ status: 502 })).toBe(true);
    expect(isConnectivityFailure({ status: 503 })).toBe(true);
    expect(isConnectivityFailure({ status: 504 })).toBe(true);
  });

  it("ignores app errors", () => {
    expect(isConnectivityFailure({ status: 400 })).toBe(false);
    expect(isConnectivityFailure({ status: 401 })).toBe(false);
    expect(isConnectivityFailure({ status: 404 })).toBe(false);
    expect(isConnectivityFailure({ status: 429 })).toBe(false);
    expect(isConnectivityFailure({ status: 500 })).toBe(false);
    expect(isConnectivityFailure(new Error("boom"))).toBe(false);
    expect(isConnectivityFailure(null)).toBe(false);
    expect(isConnectivityFailure(undefined)).toBe(false);
  });

  it("reads status and strips queries", () => {
    expect(statusOf({ status: 503 })).toBe(503);
    expect(statusOf({})).toBeUndefined();
    expect(stripQuery("/v1/tracks/abc?x=1")).toBe("/v1/tracks/abc");
    expect(stripQuery("/v1/me")).toBe("/v1/me");
  });

  it("identifies playback paths correctly", () => {
    expect(isPlaybackPath("/v1/tracks/123/playback")).toBe(true);
    expect(isPlaybackPath("/v1/tracks/abc%20123/playback")).toBe(true);
    expect(isPlaybackPath("/v1/tracks/123/playback/media")).toBe(true);
    expect(isPlaybackPath("/v1/tracks/123/lyrics")).toBe(true);
    expect(isPlaybackPath("/v1/tracks/123/playback?transport=proxy")).toBe(
      true,
    );
    expect(isPlaybackPath("/v1/me")).toBe(false);
    expect(isPlaybackPath("/v1/playlists/123")).toBe(false);
    expect(isPlaybackPath("/v1/auth/session")).toBe(false);
    expect(isPlaybackPath("/v1/search")).toBe(false);
  });
});
