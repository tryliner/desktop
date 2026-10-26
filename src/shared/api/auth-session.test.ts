import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAuthSession,
  setAuthSession,
  getValidAccessToken,
  refreshAuthSession,
  getSessionExpiryMs,
  type AuthTokens,
} from "./auth-session";

describe("auth-session token system", () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, string>();

  const localStorageMock = {
    getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn((key: string, val: string) => {
      storageMap.set(key, val);
    }),
    removeItem: vi.fn((key: string) => {
      storageMap.delete(key);
    }),
    clear: vi.fn(() => {
      storageMap.clear();
    }),
  };

  beforeEach(() => {
    storageMap.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
        configurable: true,
        writable: true,
      });
    }
    setAuthSession(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("calculates expiry timestamp correctly from ISO string or numeric epoch", () => {
    const session1: AuthTokens = {
      accessToken: "a1",
      refreshToken: "r1",
      accessTokenExpiresAt: "2026-09-02T19:00:00.000Z",
      user: { id: "u1", email: "test@liner.app" },
    };
    expect(getSessionExpiryMs(session1)).toBe(
      new Date("2026-09-02T19:00:00.000Z").getTime(),
    );

    const session2: AuthTokens = {
      accessToken: "a2",
      refreshToken: "r2",
      accessTokenExpiresAt: "",
      expiresAt: 1788370000,
      user: { id: "u2", email: "test2@liner.app" },
    };
    expect(getSessionExpiryMs(session2)).toBe(1788370000 * 1000);
  });

  it("deduplicates parallel refresh requests into a single network call", async () => {
    const initialSession: AuthTokens = {
      accessToken: "expired_token",
      refreshToken: "refresh_token_123",
      accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
      user: { id: "u1", email: "user@example.com" },
    };
    setAuthSession(initialSession);

    let fetchCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCallCount++;
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        json: async () => ({
          accessToken: "new_token_456",
          refreshToken: "new_refresh_789",
          accessTokenExpiresAt: new Date(Date.now() + 1800_000).toISOString(),
        }),
      };
    }) as any;

    // Trigger 5 concurrent refresh requests
    const results = await Promise.all([
      refreshAuthSession(),
      refreshAuthSession(),
      refreshAuthSession(),
      refreshAuthSession(),
      refreshAuthSession(),
    ]);

    // Only 1 fetch call should have occurred
    expect(fetchCallCount).toBe(1);

    // All callers must receive the exact same refreshed tokens
    for (const res of results) {
      expect(res?.accessToken).toBe("new_token_456");
      expect(res?.refreshToken).toBe("new_refresh_789");
      // Must preserve the user object from the original session
      expect(res?.user.id).toBe("u1");
      expect(res?.user.email).toBe("user@example.com");
    }

    // Storage must be updated with merged session
    const stored = getAuthSession();
    expect(stored?.accessToken).toBe("new_token_456");
    expect(stored?.user.email).toBe("user@example.com");
  });

  it("proactively refreshes token in getValidAccessToken when close to expiry", async () => {
    // Expires in 10 seconds (< 45s threshold)
    const expiringSession: AuthTokens = {
      accessToken: "soon_expired_token",
      refreshToken: "rt_abc",
      accessTokenExpiresAt: new Date(Date.now() + 10_000).toISOString(),
      user: { id: "u1", email: "user@example.com" },
    };
    setAuthSession(expiringSession);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "refreshed_valid_token",
        refreshToken: "new_rt",
        accessTokenExpiresAt: new Date(Date.now() + 1800_000).toISOString(),
      }),
    }) as any;

    const token = await getValidAccessToken();
    expect(token).toBe("refreshed_valid_token");
    expect(getAuthSession()?.accessToken).toBe("refreshed_valid_token");
  });

  it("does not refresh in getValidAccessToken if token has ample lifetime remaining", async () => {
    // Expires in 25 minutes
    const validSession: AuthTokens = {
      accessToken: "currently_valid_token",
      refreshToken: "rt_abc",
      accessTokenExpiresAt: new Date(Date.now() + 1500_000).toISOString(),
      user: { id: "u1", email: "user@example.com" },
    };
    setAuthSession(validSession);

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;

    const token = await getValidAccessToken();
    expect(token).toBe("currently_valid_token");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("awaits active refreshPromise in getValidAccessToken to avoid using stale tokens", async () => {
    const session: AuthTokens = {
      accessToken: "stale_token",
      refreshToken: "rt_in_flight",
      accessTokenExpiresAt: new Date(Date.now() + 500_000).toISOString(),
      user: { id: "u1", email: "user@example.com" },
    };
    setAuthSession(session);

    let resolveFetch: (value: any) => void;
    const slowFetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    globalThis.fetch = vi.fn().mockImplementation(() => slowFetchPromise);

    // Start a refresh in the background (sets refreshPromise)
    const refreshOp = refreshAuthSession();

    // Call getValidAccessToken while refresh is still in flight
    const validTokenPromise = getValidAccessToken();

    // Complete the refresh
    resolveFetch!({
      ok: true,
      json: async () => ({
        accessToken: "new_token_from_race",
        refreshToken: "rt_race_new",
        accessTokenExpiresAt: new Date(Date.now() + 1800_000).toISOString(),
      }),
    });

    await refreshOp;
    const token = await validTokenPromise;
    expect(token).toBe("new_token_from_race");
  });

  it("proactively refreshes in getValidAccessToken when token expires in less than 2 minutes (120s)", async () => {
    // Expires in 90 seconds (< 120s threshold)
    const expiringSession: AuthTokens = {
      accessToken: "soon_expired_90s",
      refreshToken: "rt_90s",
      accessTokenExpiresAt: new Date(Date.now() + 90_000).toISOString(),
      user: { id: "u1", email: "user@example.com" },
    };
    setAuthSession(expiringSession);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "refreshed_fresh_token",
        refreshToken: "new_rt_fresh",
        accessTokenExpiresAt: new Date(Date.now() + 1800_000).toISOString(),
      }),
    }) as any;

    const token = await getValidAccessToken();
    expect(token).toBe("refreshed_fresh_token");
  });

  it("clears session only when the server says the refresh token is dead", async () => {
    const session: AuthTokens = {
      accessToken: "old_token",
      refreshToken: "rt_1",
      accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
      user: { id: "u1", email: "user@example.com" },
    };
    setAuthSession(session);

    // 1. Server 500 error: Session must NOT be wiped
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as any;

    const res500 = await refreshAuthSession();
    expect(res500).toBeNull();
    expect(getAuthSession()).not.toBeNull();
    expect(getAuthSession()?.refreshToken).toBe("rt_1");

    vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as any;

    expect(await refreshAuthSession()).toBeNull();
    expect(getAuthSession()?.refreshToken).toBe("rt_1");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      clone() {
        return { json: async () => ({ code: "INVALID_REFRESH_TOKEN" }) };
      },
    }) as any;

    expect(await refreshAuthSession()).toBeNull();
    expect(getAuthSession()).toBeNull();
  });

  describe("refresh rejections", () => {
    const base = (): AuthTokens => ({
      accessToken: "old_token",
      refreshToken: "rt_1",
      accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
      user: { id: "u1", email: "user@example.com" },
    });
    const reject = (status = 401, code = "INVALID_SIGNATURE") => ({
      ok: false,
      status,
      headers: { get: () => null },
      clone() {
        return { json: async () => ({ code }) };
      },
    });
    const okRefresh = () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        accessToken: "new_token",
        refreshToken: "rt_2",
        accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    });

    it("a one-off 401 (e.g. a rejected signature) is retried and does not sign out", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      setAuthSession(base());
      globalThis.fetch = vi.fn().mockResolvedValueOnce(reject()).mockResolvedValueOnce(okRefresh()) as any;
      const res = await refreshAuthSession();
      expect(res?.refreshToken).toBe("rt_2");
      expect(getAuthSession()?.accessToken).toBe("new_token");
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("adopts a token rotated elsewhere instead of signing out", async () => {
      setAuthSession(base());
      const rotated = { ...base(), accessToken: "other_window_token", refreshToken: "rt_9" };
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        // another window finished a refresh meanwhile
        storageMap.set("liner_auth_session", JSON.stringify(rotated));
        return reject(401, "TOKEN_REUSED");
      }) as any;
      const res = await refreshAuthSession();
      expect(res?.refreshToken).toBe("rt_9");
      expect(getAuthSession()?.accessToken).toBe("other_window_token");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("signs out on an expired refresh session, and logs why", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      setAuthSession(base());
      globalThis.fetch = vi.fn().mockResolvedValue(reject(401, "REFRESH_SESSION_EXPIRED")) as any;
      const res = await refreshAuthSession();
      expect(res).toBeNull();
      expect(getAuthSession()).toBeNull();
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls.flat().join(" ")).toContain("REFRESH_SESSION_EXPIRED");
    });

    it("keeps the session when signature rejections never clear up", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      setAuthSession(base());
      globalThis.fetch = vi.fn().mockResolvedValue(reject(401, "SIGNATURE_SKEWED")) as any;
      expect(await refreshAuthSession()).toBeNull();
      expect(getAuthSession()?.refreshToken).toBe("rt_1");
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("keeps the session on server errors", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      setAuthSession(base());
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, headers: { get: () => null } }) as any;
      expect(await refreshAuthSession()).toBeNull();
      expect(getAuthSession()?.refreshToken).toBe("rt_1");
    });
  });
});
