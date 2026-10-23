import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  refreshTokens,
  fetchUserPlaylists,
  fetchSpotifyUserPlaylistTracks,
  parseRetryAfterHeader,
} from "@/features/library/services/import/sources/spotify/spotifyOAuth";
import {
  useSpotifyAuthStore,
  STORAGE_KEY_TOKENS,
  isSpotifyRevocationError,
} from "@/features/library/store/spotifyAuthStore";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("Empirical Challenger M1 Round 2.1: Concurrency & Stress", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.localStorage = createMockStorage();
    useSpotifyAuthStore.getState().disconnect();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("1. Concurrency Deduplication & Single-Flight Coalescing", () => {
    it("empirically verifies 5 concurrent getValidAccessToken calls trigger exactly 1 network request", async () => {
      let networkCalls = 0;
      const initialTokens = {
        accessToken: "expired_token",
        refreshToken: "refresh_rot_1",
        expiresAt: Date.now() - 5000,
        scope: "playlist-read-private",
        tokenType: "Bearer",
      };

      useSpotifyAuthStore.getState().setTokens(initialTokens);

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/token")) {
          networkCalls++;
          await new Promise((resolve) => setTimeout(resolve, 30));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: `coalesced_token_${networkCalls}`,
              refresh_token: `coalesced_refresh_${networkCalls}`,
              expires_in: 3600,
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const promises = [
        useSpotifyAuthStore.getState().getValidAccessToken(),
        useSpotifyAuthStore.getState().getValidAccessToken(),
        useSpotifyAuthStore.getState().getValidAccessToken(),
        useSpotifyAuthStore.getState().getValidAccessToken(),
        useSpotifyAuthStore.getState().getValidAccessToken(),
      ];

      const results = await Promise.all(promises);

      expect(networkCalls).toBe(1);
      expect(results).toHaveLength(5);
      for (const token of results) {
        expect(token).toBe("coalesced_token_1");
      }
      expect(useSpotifyAuthStore.getState().tokens?.accessToken).toBe("coalesced_token_1");
    });

    it("empirically verifies 50 concurrent getValidAccessToken calls trigger exactly 1 network request", async () => {
      let networkCalls = 0;
      useSpotifyAuthStore.getState().setTokens({
        accessToken: "expired_token_burst",
        refreshToken: "refresh_burst_1",
        expiresAt: Date.now() - 10000,
        scope: "playlist-read-private",
        tokenType: "Bearer",
      });

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/token")) {
          networkCalls++;
          await new Promise((resolve) => setTimeout(resolve, 40));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "massive_burst_token",
              refresh_token: "massive_burst_refresh",
              expires_in: 3600,
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const burstPromises = Array.from({ length: 50 }, () =>
        useSpotifyAuthStore.getState().getValidAccessToken()
      );

      const results = await Promise.all(burstPromises);

      expect(networkCalls).toBe(1);
      expect(results).toHaveLength(50);
      expect(results.every((t) => t === "massive_burst_token")).toBe(true);
    });

    it("handles partial caller aborts without disrupting sibling concurrent callers or triggering duplicate calls", async () => {
      let networkCalls = 0;
      useSpotifyAuthStore.getState().setTokens({
        accessToken: "expiring_soon",
        refreshToken: "refresh_abort_test",
        expiresAt: Date.now() + 1000, // within 60s buffer
        scope: "playlist-read-private",
        tokenType: "Bearer",
      });

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/token")) {
          networkCalls++;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "sibling_survival_token",
              refresh_token: "sibling_survival_refresh",
              expires_in: 3600,
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const abortCtrl1 = new AbortController();
      const abortCtrl2 = new AbortController();

      // Trigger callers: 2 with signals to be aborted, 3 without
      const p1 = useSpotifyAuthStore.getState().getValidAccessToken(abortCtrl1.signal);
      const p2 = useSpotifyAuthStore.getState().getValidAccessToken(abortCtrl2.signal);
      const p3 = useSpotifyAuthStore.getState().getValidAccessToken();
      const p4 = useSpotifyAuthStore.getState().getValidAccessToken();
      const p5 = useSpotifyAuthStore.getState().getValidAccessToken();

      // Abort p1 and p2 during in-flight network request
      setTimeout(() => abortCtrl1.abort(), 10);
      setTimeout(() => abortCtrl2.abort(), 15);

      const results = await Promise.allSettled([p1, p2, p3, p4, p5]);

      expect(results[0].status).toBe("rejected");
      expect((results[0] as PromiseRejectedResult).reason.name).toBe("AbortError");

      expect(results[1].status).toBe("rejected");
      expect((results[1] as PromiseRejectedResult).reason.name).toBe("AbortError");

      expect(results[2].status).toBe("fulfilled");
      expect((results[2] as PromiseFulfilledResult<string>).value).toBe("sibling_survival_token");

      expect(results[3].status).toBe("fulfilled");
      expect((results[3] as PromiseFulfilledResult<string>).value).toBe("sibling_survival_token");

      expect(results[4].status).toBe("fulfilled");
      expect((results[4] as PromiseFulfilledResult<string>).value).toBe("sibling_survival_token");

      expect(networkCalls).toBe(1);
    });

    it("resets inFlightRefreshPromise after failure so subsequent calls can retry", async () => {
      let callCount = 0;
      useSpotifyAuthStore.getState().setTokens({
        accessToken: "expired",
        refreshToken: "temporary_fail_refresh",
        expiresAt: Date.now() - 5000,
        scope: "playlist-read-private",
        tokenType: "Bearer",
      });

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Non-revocation transient 500 error
          return {
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ error: "Internal Server Error" }),
          } as any;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "recovered_token",
            expires_in: 3600,
          }),
        } as any;
      });

      // First call fails with 500
      await expect(useSpotifyAuthStore.getState().getValidAccessToken()).rejects.toThrow();
      expect(callCount).toBe(1);
      // Store should NOT disconnect on transient 500
      expect(useSpotifyAuthStore.getState().status).toBe("connected");

      // Second call must NOT be stuck in stale in-flight promise; it should issue attempt 2
      const token = await useSpotifyAuthStore.getState().getValidAccessToken();
      expect(token).toBe("recovered_token");
      expect(callCount).toBe(2);
    });
  });

  describe("2. Revoked Refresh Tokens & Disconnection", () => {
    it("empirically verifies HTTP 400 invalid_grant transitions store to disconnected", async () => {
      useSpotifyAuthStore.getState().setTokens({
        accessToken: "expired",
        refreshToken: "revoked_pkce_token",
        expiresAt: Date.now() - 1000,
        scope: "playlist-read-private",
        tokenType: "Bearer",
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid refresh token",
          }),
      } as any);

      await expect(
        useSpotifyAuthStore.getState().getValidAccessToken()
      ).rejects.toThrow(/invalid_grant: Invalid refresh token/);

      expect(useSpotifyAuthStore.getState().status).toBe("disconnected");
      expect(useSpotifyAuthStore.getState().tokens).toBeNull();
      expect(globalThis.localStorage.getItem(STORAGE_KEY_TOKENS)).toBeNull();

      // Subsequent call must throw not connected error
      await expect(
        useSpotifyAuthStore.getState().getValidAccessToken()
      ).rejects.toThrow("Not connected to Spotify");
    });

    it("empirically verifies HTTP 401 transitions store to disconnected", async () => {
      useSpotifyAuthStore.getState().setTokens({
        accessToken: "expired",
        refreshToken: "unauthorized_refresh",
        expiresAt: Date.now() - 1000,
        scope: "playlist-read-private",
        tokenType: "Bearer",
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { status: 401, message: "Unauthorized token" } }),
      } as any);

      await expect(
        useSpotifyAuthStore.getState().getValidAccessToken()
      ).rejects.toThrow();

      expect(useSpotifyAuthStore.getState().status).toBe("disconnected");
      expect(useSpotifyAuthStore.getState().tokens).toBeNull();
      expect(globalThis.localStorage.getItem(STORAGE_KEY_TOKENS)).toBeNull();
    });

    it("isSpotifyRevocationError correctly discriminates revocation vs other errors", () => {
      expect(isSpotifyRevocationError({ status: 401 })).toBe(true);
      expect(isSpotifyRevocationError({ error: "invalid_grant" })).toBe(true);
      expect(isSpotifyRevocationError({ message: "invalid_grant: Invalid refresh token" })).toBe(true);
      expect(isSpotifyRevocationError({ message: "Refresh token revoked by user" })).toBe(true);
      expect(isSpotifyRevocationError({ status: 400, error: "invalid_grant" })).toBe(true);

      // Non-revocation errors
      expect(isSpotifyRevocationError({ status: 500, message: "Internal Server Error" })).toBe(false);
      expect(isSpotifyRevocationError({ status: 429, message: "Rate limit exceeded" })).toBe(false);
      expect(isSpotifyRevocationError(new Error("Network timeout"))).toBe(false);
      expect(isSpotifyRevocationError(null)).toBe(false);
      expect(isSpotifyRevocationError(undefined)).toBe(false);
    });
  });

  describe("3. Retry-After Header & HTTP-Date Parsing Without NaN / Warnings", () => {
    it("parses RFC 7231 IMF-fixdate HTTP-date headers accurately", () => {
      const fixedNow = 1700000000000;
      const targetTime = fixedNow + 3000; // 3s in future (HTTP-date has second granularity)
      const httpDate = new Date(targetTime).toUTCString();

      const delayMs = parseRetryAfterHeader(httpDate, 1000, 100, 10000, () => fixedNow);
      expect(delayMs).toBe(3000);
      expect(Number.isNaN(delayMs)).toBe(false);
    });

    it("clamps past HTTP-dates to minDelayMs without NaN or negative values", () => {
      const fixedNow = 1700000000000;
      const pastTime = fixedNow - 5000; // in the past
      const httpDate = new Date(pastTime).toUTCString();

      const delayMs = parseRetryAfterHeader(httpDate, 1000, 100, 10000, () => fixedNow);
      expect(delayMs).toBe(100); // clamped to minDelayMs
      expect(Number.isNaN(delayMs)).toBe(false);
    });

    it("clamps distant future HTTP-dates to maxDelayMs", () => {
      const fixedNow = 1700000000000;
      const distantFuture = fixedNow + 60000; // 60s
      const httpDate = new Date(distantFuture).toUTCString();

      const delayMs = parseRetryAfterHeader(httpDate, 1000, 100, 10000, () => fixedNow);
      expect(delayMs).toBe(10000); // clamped to maxDelayMs
    });

    it("safely handles malformed, NaN, and corrupt Retry-After values with default delay", () => {
      const corruptInputs = [
        "not-a-date-or-number",
        "NaN",
        "",
        "   ",
        "undefined",
        "Wed 32 Oct 99999",
      ];

      for (const input of corruptInputs) {
        const delayMs = parseRetryAfterHeader(input, 1500);
        expect(delayMs).toBe(1500);
        expect(Number.isNaN(delayMs)).toBe(false);
      }
    });

    it("executes HTTP 429 retry cycle with HTTP-date header with zero process warnings", async () => {
      const warnings: Array<{ name: string; message: string }> = [];
      const warningListener = (warning: Error) => {
        warnings.push({ name: warning.name, message: warning.message });
      };
      process.on("warning", warningListener);

      try {
        let attempts = 0;
        const targetDate = new Date(Date.now() + 150).toUTCString();

        globalThis.fetch = vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts === 1) {
            return {
              ok: false,
              status: 429,
              headers: new Headers({ "retry-after": targetDate }),
            } as any;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "warn_free_access_token",
              expires_in: 3600,
            }),
          } as any;
        });

        const result = await refreshTokens("warn_free_refresh");
        expect(result.accessToken).toBe("warn_free_access_token");
        expect(attempts).toBe(2);

        // Check for any NaN timeout warnings
        const nanWarnings = warnings.filter(
          (w) => w.name === "TimeoutNaNWarning" || w.message.includes("NaN")
        );
        expect(nanWarnings).toHaveLength(0);
      } finally {
        process.off("warning", warningListener);
      }
    });
  });
});
