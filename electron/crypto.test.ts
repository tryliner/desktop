import { describe, it, expect, beforeEach } from "vitest";
import nodeCrypto from "node:crypto";
import {
  signCoverUrl,
  signRequest,
  signMonitorRequest,
  signRawPayload,
  syncServerTime,
  getServerTimeOffset,
  setServerTimeOffset,
  getAdjustedTimestamp,
  setDevSigningSecret,
} from "./crypto";

describe("Electron Crypto Signer", () => {
  beforeEach(() => {
    setServerTimeOffset(0);
  });

  it("computes cover HMAC signature correctly", () => {
    const sig1 = signCoverUrl("test-payload");
    expect(sig1).toBe("9LSBe7mxc1bBjekVK62_YFbxUAxOvphtfgZZK1Wp_FY");

    const payload2 = "eyJ1IjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2FiYyIsInMiOjUxMn0";
    const sig2 = signCoverUrl(payload2);
    expect(sig2).toBe("36qoWwMzCP9TrkhwvUpv5qoid77_hPbeno1y58nn_7E");
  });

  it("signs API request with empty body canonical format", () => {
    const res = signRequest({
      method: "get",
      path: "/v1/search?query=test",
      body: null,
    });

    expect(res.signature).toBeDefined();
    expect(res.signature.length).toBeGreaterThan(0);
    expect(res.timestamp).toBeGreaterThan(0);
    expect(res.nonce).toMatch(/^[0-9a-f]{16}$/);
  });

  it("signs API request with non-empty body", () => {
    const res = signRequest({
      method: "post",
      path: "/v1/playlists",
      body: JSON.stringify({ name: "Favorites" }),
    });

    expect(res.signature).toBeDefined();
    expect(res.signature.length).toBeGreaterThan(0);
    expect(res.timestamp).toBeGreaterThan(0);
    expect(res.nonce).toMatch(/^[0-9a-f]{16}$/);
  });

  it("signs monitor telemetry request with canonical format", () => {
    const res = signMonitorRequest({
      method: "post",
      path: "/v1/ingest",
      body: JSON.stringify({ events: [{ title: "Playback started" }] }),
    });

    expect(res.signature).toBeDefined();
    expect(res.signature.length).toBeGreaterThan(0);
    expect(res.timestamp).toBeGreaterThan(0);
    expect(res.nonce).toMatch(/^[0-9a-f]{16}$/);
  });

  it("calculates server time delta from Date header and adjusts timestamp", () => {
    // Simulate server being 1 hour (3600 seconds) ahead
    const simulatedServerTime = new Date(Date.now() + 3600 * 1000).toUTCString();
    const offset = syncServerTime(simulatedServerTime);

    expect(offset).toBeGreaterThanOrEqual(3590 * 1000);
    expect(getServerTimeOffset()).toBe(offset);

    const adjusted = getAdjustedTimestamp();
    const local = Math.floor(Date.now() / 1000);
    expect(adjusted - local).toBeGreaterThanOrEqual(3590);

    const signed = signRequest({
      method: "get",
      path: "/v1/tracks/123",
    });

    expect(signed.timestamp - local).toBeGreaterThanOrEqual(3590);
  });
});

describe("dev signing secret", () => {
  const secret = "dev-test-secret";

  function serverExpected(method: string, path: string, body: string, timestamp: number, nonce: string): string {
    const bodySha256 = nodeCrypto.createHash("sha256").update(body).digest("hex");
    const canonical = `${method}\n${path.split("?")[0]}\n${timestamp}\n${nonce}\n${bodySha256}`;
    return nodeCrypto.createHmac("sha256", secret).update(canonical).digest("base64url");
  }

  it("signs with the configured secret in the format the api verifies", () => {
    setDevSigningSecret(secret);
    try {
      const signed = signRequest({ method: "post", path: "/v1/tracks/abc?x=1", body: '{"a":1}', timestamp: 1_800_000_000 });
      expect(signed.signature).toBe(serverExpected("POST", "/v1/tracks/abc", '{"a":1}', 1_800_000_000, signed.nonce));
    } finally {
      setDevSigningSecret(undefined);
    }
  });

  it("falls back to the embedded signer when no dev secret is set", () => {
    setDevSigningSecret(undefined);
    const signed = signRequest({ method: "GET", path: "/v1/me", timestamp: 1_800_000_000 });
    expect(signed.signature).not.toBe(serverExpected("GET", "/v1/me", "", 1_800_000_000, signed.nonce));
  });
});
