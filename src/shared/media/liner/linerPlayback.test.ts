import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/auth-session", () => ({
  getAuthSession: () => ({ accessToken: "token" }),
  getValidAccessToken: async () => "token",
}));
vi.mock("@/shared/api/baseUrl", () => ({
  getApiBaseUrl: () => "https://api.test",
}));
vi.mock("@/shared/utils/logger", () => ({ log: vi.fn() }));

const r2 = {
  source: "r2",
  url: "https://r2.test/tracks/dQw4w9WgXcQ?sig=1",
  expiresAt: "2026-10-31T18:00:00.000Z",
  mimeType: "audio/webm",
  codec: "opus",
  size: 3_000_000,
};

function answer(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("resolveLinerStream", () => {
  let resolveLinerStream: typeof import("./linerPlayback").resolveLinerStream;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    // a fresh module: the pause is module state
    vi.resetModules();
    ({ resolveLinerStream } = await import("./linerPlayback"));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("returns the r2 plan", async () => {
    globalThis.fetch = answer(200, r2);
    await expect(resolveLinerStream("dQw4w9WgXcQ")).resolves.toEqual(r2);
  });

  it("plays from the source on a client plan and asks again next time", async () => {
    globalThis.fetch = answer(200, {
      source: "client",
      reason: "not_cached",
      ingest: "queued",
      retryAfterSeconds: null,
    });
    await expect(resolveLinerStream("dQw4w9WgXcQ")).resolves.toBeNull();
    await expect(resolveLinerStream("dQw4w9WgXcQ")).resolves.toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("stops asking for retryAfterSeconds", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-10-31T12:00:00.000Z") });
    globalThis.fetch = answer(200, {
      source: "client",
      reason: "budget_exhausted",
      ingest: null,
      retryAfterSeconds: 120,
    });
    await expect(resolveLinerStream("dQw4w9WgXcQ")).resolves.toBeNull();
    await expect(resolveLinerStream("dQw4w9WgXcQ")).resolves.toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.parse("2026-10-31T12:02:01.000Z"));
    globalThis.fetch = answer(200, r2);
    await expect(resolveLinerStream("dQw4w9WgXcQ")).resolves.toEqual(r2);
  });

  it("plays from the source on an error answer without pausing", async () => {
    globalThis.fetch = answer(400, {
      statusCode: 400,
      error: "Bad Request",
      code: "VALIDATION_ERROR",
      message: "bad id",
    });
    await expect(resolveLinerStream("bad")).resolves.toBeNull();
    globalThis.fetch = answer(200, r2);
    await expect(resolveLinerStream("dQw4w9WgXcQ")).resolves.toEqual(r2);
  });
});
