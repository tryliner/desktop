import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./requestSigner", () => ({
  signApiRequest: async () => ({ "x-liner-signature": "sig" }),
  syncServerTime: () => undefined,
}));
vi.mock("./auth-session", () => ({
  getAuthSession: () => ({ accessToken: "token", refreshToken: "refresh" }),
  getSessionExpiryMs: () => Date.now() + 60_000,
  getValidAccessToken: async () => "token",
  refreshAuthSession: async () => null,
  setAuthSession: () => undefined,
}));
vi.mock("./baseUrl", () => ({ getApiBaseUrl: () => "https://api.test" }));
vi.mock("@/shared/ui/Toast", () => ({ showToast: () => undefined }));
vi.mock("@/shared/telemetry", () => ({
  telemetry: { trackNetwork: () => undefined },
}));

import { call } from "./call";
import { ApiError } from "./apiError";

const fetchMock = vi.fn();

function reply(status: number, body?: unknown) {
  fetchMock.mockImplementationOnce(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      }),
  );
}

function sent(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

describe("call", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls the route of the key with its query and answers its body", async () => {
    reply(200, { items: [], nextCursor: null });
    const page = await call("GET /v1/me/likes", {
      query: { limit: 5, cursor: "c1" },
    });
    expect(page.nextCursor).toBeNull();
    expect(sent().url).toBe("https://api.test/v1/me/likes?limit=5&cursor=c1");
    expect(sent().init).toMatchObject({
      method: "GET",
      headers: { Authorization: "Bearer token", "x-liner-signature": "sig" },
    });
  });

  it("sends params and a json body, a 204 answers undefined", async () => {
    reply(204);
    await expect(
      call("PUT /v1/me/likes/:trackId", {
        params: { trackId: "sc:42" },
        body: {},
      }),
    ).resolves.toBeUndefined();
    expect(sent().url).toBe("https://api.test/v1/me/likes/sc%3A42");
    expect(sent().init).toMatchObject({
      method: "PUT",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("throws an ApiError with the code and details of the answer", async () => {
    const details = {
      resource: "playlists",
      limit: 50,
      count: 50,
      plusLimit: 100,
    };
    reply(403, {
      statusCode: 403,
      error: "Forbidden",
      code: "PLAN_LIMIT_REACHED",
      message: "Limit reached.",
      details,
    });
    const error = await call("POST /v1/me/playlists", {
      body: { title: "Mine" },
    }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      code: "PLAN_LIMIT_REACHED",
      details,
    });
  });
});
