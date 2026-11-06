import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../requestSigner", () => ({
  signApiRequest: async () => ({}),
  syncServerTime: () => undefined,
}));
vi.mock("../auth-session", () => ({
  getAuthSession: () => null,
  getSessionExpiryMs: () => null,
  getValidAccessToken: async () => null,
  refreshAuthSession: async () => null,
  setAuthSession: () => undefined,
}));
vi.mock("../baseUrl", () => ({ getApiBaseUrl: () => "https://api.test" }));
vi.mock("@/shared/ui/Toast", () => ({ showToast: () => undefined }));
vi.mock("@/shared/telemetry", () => ({
  telemetry: { trackNetwork: () => undefined },
}));
const solvePow = vi.fn();
vi.mock("../proofOfWorkRunner", () => ({
  solvePow: (...args: unknown[]) => solvePow(...args),
}));

import { authApi } from "./auth";

const fetchMock = vi.fn();
const tokens = {
  accessToken: "a",
  refreshToken: "r",
  accessTokenExpiresAt: "2026-11-04T00:15:00.000Z",
  user: { id: "u1", email: "a@b.c" },
};

function reply(status: number, body?: unknown) {
  fetchMock.mockImplementationOnce(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      }),
  );
}

function bodyOf(index: number): unknown {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit;
  return JSON.parse(String(init.body));
}

describe("authApi.login", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    solvePow.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("solves the challenge and sends the proof with the credentials", async () => {
    reply(200, {
      mode: "required",
      algorithm: "argon2id-v1",
      token: "t",
      salt: "s",
      difficulty: 1,
      memoryKiB: 8,
      iterations: 1,
      parallelism: 1,
      hashLength: 32,
      expiresAt: "2099-01-01T00:00:00.000Z",
      turnstile: { mode: "off", edge: false },
    });
    solvePow.mockResolvedValue({ token: "t", nonce: "n" });
    reply(200, tokens);

    await authApi.login("a@b.c", "password1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.test/v1/auth/challenge",
    );
    expect(bodyOf(0)).toEqual({ purpose: "login", email: "a@b.c" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.test/v1/auth/login");
    expect(bodyOf(1)).toEqual({
      email: "a@b.c",
      password: "password1",
      pow: { token: "t", nonce: "n" },
    });
  });

  it("signs in without a proof when the api has no challenge route", async () => {
    reply(404, { statusCode: 404, code: "ROUTE_NOT_FOUND", message: "x" });
    reply(200, tokens);

    await authApi.login("a@b.c", "password1");

    expect(solvePow).not.toHaveBeenCalled();
    expect(bodyOf(1)).toEqual({ email: "a@b.c", password: "password1" });
  });
});

describe("authApi.requestPasswordReset", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    solvePow.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const resetChallenge = {
    mode: "required",
    algorithm: "argon2id-v1",
    token: "t",
    salt: "s",
    difficulty: 1,
    memoryKiB: 8,
    iterations: 1,
    parallelism: 1,
    hashLength: 32,
    expiresAt: "2099-01-01T00:00:00.000Z",
    turnstile: { mode: "off", edge: false },
  };

  it("solves a reset challenge and posts the email with the proof", async () => {
    reply(200, resetChallenge);
    solvePow.mockResolvedValue({ token: "t", nonce: "n" });
    reply(202, { expiresInMinutes: 30 });

    await expect(authApi.requestPasswordReset("a@b.c")).resolves.toEqual({
      expiresInMinutes: 30,
    });

    expect(bodyOf(0)).toEqual({ purpose: "reset", email: "a@b.c" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.test/v1/auth/recovery-link",
    );
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(bodyOf(1)).toEqual({
      email: "a@b.c",
      pow: { token: "t", nonce: "n" },
    });
  });

  it("asks for a fresh challenge once when the proof went stale", async () => {
    reply(200, resetChallenge);
    solvePow.mockResolvedValue({ token: "t", nonce: "n" });
    reply(403, { statusCode: 403, code: "POW_EXPIRED", message: "x" });
    reply(200, resetChallenge);
    reply(202, { expiresInMinutes: 30 });

    await authApi.requestPasswordReset("a@b.c");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(bodyOf(2)).toEqual({ purpose: "reset", email: "a@b.c" });
  });

  it("passes a 429 on as an api error", async () => {
    reply(200, resetChallenge);
    solvePow.mockResolvedValue({ token: "t", nonce: "n" });
    reply(429, {
      statusCode: 429,
      code: "RATE_LIMITED",
      message: "x",
      retryAfterSeconds: 60,
    });

    await expect(authApi.requestPasswordReset("a@b.c")).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
  });
});
