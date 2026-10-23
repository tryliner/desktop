import { describe, expect, it } from "vitest";
import { parseSpotifyCallback, validateAndExtractCallback } from "./spotifyCallback";

describe("Spotify Callback Parser", () => {
  it("parses deep link callback URL with code and state", () => {
    const url = "liner://spotify-callback?code=AQD123xyz&state=secret_state_456";
    const payload = parseSpotifyCallback(url);

    expect(payload.code).toBe("AQD123xyz");
    expect(payload.state).toBe("secret_state_456");
    expect(payload.error).toBeUndefined();
  });

  it("parses web redirect callback URL with code and state", () => {
    const url = "http://localhost:5173/callback?code=auth_code_789&state=state_abc";
    const payload = parseSpotifyCallback(url);

    expect(payload.code).toBe("auth_code_789");
    expect(payload.state).toBe("state_abc");
    expect(payload.error).toBeUndefined();
  });

  it("parses hash fragment redirect URL", () => {
    const url = "http://localhost:5173/callback#code=hash_code_999&state=hash_state";
    const payload = parseSpotifyCallback(url);

    expect(payload.code).toBe("hash_code_999");
    expect(payload.state).toBe("hash_state");
  });

  it("extracts error when user cancels or denies authorization", () => {
    const url = "liner://spotify-callback?error=access_denied&state=user_state";
    const payload = parseSpotifyCallback(url);

    expect(payload.error).toBe("access_denied");
    expect(payload.state).toBe("user_state");
    expect(payload.code).toBeUndefined();
  });

  it("validates callback and returns code when state matches", () => {
    const url = "liner://spotify-callback?code=valid_code&state=expected_state";
    const result = validateAndExtractCallback(url, "expected_state");

    expect(result.code).toBe("valid_code");
    expect(result.state).toBe("expected_state");
  });

  it("throws on CSRF state mismatch", () => {
    const url = "liner://spotify-callback?code=valid_code&state=attacker_state";
    expect(() => validateAndExtractCallback(url, "expected_state")).toThrow("CSRF token mismatch");
  });

  it("throws when error is present in callback", () => {
    const url = "liner://spotify-callback?error=access_denied";
    expect(() => validateAndExtractCallback(url)).toThrow("Spotify authorization failed: access_denied");
  });

  it("throws when code is missing", () => {
    const url = "liner://spotify-callback?state=only_state";
    expect(() => validateAndExtractCallback(url)).toThrow("Missing authorization code");
  });
});
