import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBaseScriptUrl, parseTvOauthClient } from "./tvOauthClient";
import {
  pollTvDeviceToken,
  requestTvDeviceCode,
  type TvDeviceCode,
} from "./tvDeviceFlow";
import { YoutubeAuthError } from "./tvTokens";

const client = {
  clientId: "id.apps.googleusercontent.com",
  clientSecret: "secret",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deviceCode(overrides: Partial<TvDeviceCode> = {}): TvDeviceCode {
  return {
    deviceCode: "device",
    userCode: "ABC-DEF-GHI",
    verificationUrl: "https://www.google.com/device",
    activationUrl: "https://www.google.com/device?user_code=ABC-DEF-GHI",
    expiresAt: Date.now() + 60_000,
    intervalMs: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tv oauth client scraping", () => {
  it("finds the kabuki base script and its first client credentials", () => {
    const page = `s.src = '/s/_/kabuki/_/js/k=kabuki.base.en_US.x/d=1/m=base';`;
    expect(parseBaseScriptUrl(page)).toBe(
      "https://www.youtube.com/s/_/kabuki/_/js/k=kabuki.base.en_US.x/d=1/m=base",
    );
    const script = `a={clientId:"first.apps.googleusercontent.com",bi:"s1"};b={clientId:"second",bi:"s2"}`;
    expect(parseTvOauthClient(script)).toEqual({
      clientId: "first.apps.googleusercontent.com",
      clientSecret: "s1",
    });
    expect(parseTvOauthClient("nothing here")).toBeNull();
  });
});

describe("tv device flow", () => {
  it("requests a device code and builds the activation url", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        device_code: "dc",
        user_code: "HSD-DPH-YKQX",
        expires_in: 1800,
        interval: 5,
        verification_url: "https://www.google.com/device",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const code = await requestTvDeviceCode(client);
    expect(code).toMatchObject({
      deviceCode: "dc",
      userCode: "HSD-DPH-YKQX",
      activationUrl: "https://www.google.com/device?user_code=HSD-DPH-YKQX",
      intervalMs: 5000,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toMatchObject({
      client_id: client.clientId,
      device_model: "ytlr::",
    });
  });

  it("keeps polling while authorization is pending and returns the tokens", async () => {
    const responses = [
      jsonResponse({ error: "authorization_pending" }, 428),
      jsonResponse({ error: "slow_down" }, 403),
      jsonResponse({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    ];
    const fetchMock = vi.fn(async () => responses.shift() ?? jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const pending = pollTvDeviceToken(client, deviceCode());
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    await expect(pending).resolves.toMatchObject({
      accessToken: "at",
      refreshToken: "rt",
      tokenType: "Bearer",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops when the user denies access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "access_denied" }, 403)),
    );
    await expect(pollTvDeviceToken(client, deviceCode())).rejects.toThrow(
      YoutubeAuthError,
    );
  });

  it("gives up once the device code expires", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: "authorization_pending" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      pollTvDeviceToken(client, deviceCode({ expiresAt: Date.now() - 1 })),
    ).rejects.toMatchObject({
      code: "expired_token",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
