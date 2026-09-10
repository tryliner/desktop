import { describe, expect, it } from "vitest";
import { isConnectivityFailure, statusOf, stripQuery } from "./failureKind";

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
});
