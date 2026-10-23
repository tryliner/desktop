import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateAuthorizeUrl,
  exchangeCode,
  refreshTokens,
  fetchUserPlaylists,
  fetchSpotifyUserPlaylistTracks,
  normalizeSpotifyUserPlaylist,
  normalizeSpotifyTrack,
  SpotifyOAuthClientImpl,
  type RawSpotifyTrack,
} from "@/features/library/services/import/sources/spotify/spotifyOAuth";
import {
  useSpotifyAuthStore,
  STORAGE_KEY_TOKENS,
  STORAGE_KEY_PENDING_PKCE,
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

describe("Adversarial Suite 1: PKCE Verifier & Challenge Entropy / RFC Conformance", () => {
  it("RFC 7636 Appendix B test vector matches exactly", async () => {
    // Official RFC 7636 Appendix B Test Vector
    const rfcVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    const actualChallenge = await generateCodeChallenge(rfcVerifier);

    expect(actualChallenge).toBe(expectedChallenge);
  });

  it("produces correct Base64URL encoding without padding, plus, or slash", async () => {
    // Empty string SHA-256 test
    const emptyChallenge = await generateCodeChallenge("");
    // SHA256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    // In Base64URL: 47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU (43 chars, no =)
    expect(emptyChallenge).toBe("47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU");
    expect(emptyChallenge).not.toContain("=");
    expect(emptyChallenge).not.toContain("+");
    expect(emptyChallenge).not.toContain("/");
    expect(emptyChallenge.length).toBe(43);
  });

  it("handles RFC 7636 unreserved character full set verifier", async () => {
    const allUnreserved = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
    const challenge = await generateCodeChallenge(allUnreserved);
    expect(challenge).toHaveLength(43);
    expect(/^[A-Za-z0-9\-_]+$/.test(challenge)).toBe(true);
  });

  it("verifies length bounds (min 43, max 128 as per RFC 7636 section 4.1)", () => {
    const defaultVerifier = generateCodeVerifier();
    expect(defaultVerifier.length).toBeGreaterThanOrEqual(43);
    expect(defaultVerifier.length).toBeLessThanOrEqual(128);

    const minVerifier = generateCodeVerifier(43);
    expect(minVerifier.length).toBe(43);
    expect(/^[A-Za-z0-9\-._~]+$/.test(minVerifier)).toBe(true);

    const maxVerifier = generateCodeVerifier(128);
    expect(maxVerifier.length).toBe(128);
    expect(/^[A-Za-z0-9\-._~]+$/.test(maxVerifier)).toBe(true);
  });

  it("generates 1,000 distinct verifiers with zero collisions and high Shannon entropy", () => {
    const N = 1000;
    const verifiers = new Set<string>();
    const charCounts = new Map<string, number>();
    let totalChars = 0;

    for (let i = 0; i < N; i++) {
      const v = generateCodeVerifier(64);
      verifiers.add(v);
      for (const char of v) {
        charCounts.set(char, (charCounts.get(char) || 0) + 1);
        totalChars++;
      }
    }

    // Zero collisions in 1000 samples
    expect(verifiers.size).toBe(N);

    // Calculate Shannon entropy: H = -sum(p * log2(p))
    let entropy = 0;
    for (const count of charCounts.values()) {
      const p = count / totalChars;
      entropy -= p * Math.log2(p);
    }

    // Theoretical maximum for 66 distinct symbols is log2(66) = 6.04439 bits/symbol
    // Empirical entropy should be > 5.95 bits/symbol
    expect(entropy).toBeGreaterThan(5.95);
    expect(entropy).toBeLessThanOrEqual(Math.log2(66));
  });
});

describe("Adversarial Suite 2: Concurrent Token Refresh & Race Conditions", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.localStorage = createMockStorage();
    useSpotifyAuthStore.getState().disconnect();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reveals race conditions when multiple callers refresh expired tokens simultaneously", async () => {
    let refreshNetworkCalls = 0;
    const initialTokens = {
      accessToken: "expired_access_token",
      refreshToken: "valid_rotating_refresh_token_v1",
      expiresAt: Date.now() - 1000, // already expired
      scope: "playlist-read-private",
      tokenType: "Bearer",
    };

    useSpotifyAuthStore.getState().setTokens(initialTokens);

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      if (url.includes("/api/token")) {
        refreshNetworkCalls++;
        // Simulate network latency (25ms)
        await new Promise((resolve) => setTimeout(resolve, 25));

        const body = init?.body?.toString() || "";
        // In OAuth 2.0 Token Rotation, using the old refresh token more than once fails
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: `new_access_token_${refreshNetworkCalls}`,
            refresh_token: `new_refresh_token_${refreshNetworkCalls}`,
            expires_in: 3600,
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    // Fire 5 concurrent requests for valid access token
    const results = await Promise.all([
      useSpotifyAuthStore.getState().getValidAccessToken(),
      useSpotifyAuthStore.getState().getValidAccessToken(),
      useSpotifyAuthStore.getState().getValidAccessToken(),
      useSpotifyAuthStore.getState().getValidAccessToken(),
      useSpotifyAuthStore.getState().getValidAccessToken(),
    ]);

    // Check whether all callers got an access token
    for (const token of results) {
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    }

    // Verify single-flight coalescing:
    // With 5 concurrent callers, exactly 1 network call was triggered.
    expect(refreshNetworkCalls).toBe(1);
  });

  it("tests behavior when a concurrent refresh succeeds across callers without rotation collision", async () => {
    let callIndex = 0;
    const initialTokens = {
      accessToken: "expiring_access_token",
      refreshToken: "rotating_refresh_token_alpha",
      expiresAt: Date.now() + 5000, // within 60s buffer
      scope: "playlist-read-private",
      tokenType: "Bearer",
    };

    useSpotifyAuthStore.getState().setTokens(initialTokens);

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/token")) {
        callIndex++;
        const currentCall = callIndex;
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (currentCall === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "refreshed_access_success",
              refresh_token: "rotating_refresh_token_beta",
              expires_in: 3600,
            }),
          } as any;
        } else {
          // Token rotation invalidated the token for concurrent attempts!
          return {
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: "invalid_grant", error_description: "Refresh token revoked" }),
          } as any;
        }
      }
      return { ok: false, status: 404 } as any;
    });

    const promises = [
      useSpotifyAuthStore.getState().getValidAccessToken().catch((e) => e),
      useSpotifyAuthStore.getState().getValidAccessToken().catch((e) => e),
    ];

    const outcomes = await Promise.all(promises);

    expect(outcomes[0]).toBe("refreshed_access_success");
    expect(outcomes[1]).toBe("refreshed_access_success");
    // Demonstrates single-flight deduplication: concurrent callers share the same refresh operation
    expect(callIndex).toBe(1);
  });

  it("proves clean disconnection on revoked refresh token with status 400", async () => {
    // Spotify returns HTTP 400 with {"error": "invalid_grant", "error_description": "Invalid refresh token"}
    // per RFC 6749 Section 5.2
    const expiredTokens = {
      accessToken: "expired_token",
      refreshToken: "revoked_token",
      expiresAt: Date.now() - 5000,
      scope: "playlist-read-private",
      tokenType: "Bearer",
    };
    useSpotifyAuthStore.getState().setTokens(expiredTokens);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: "invalid_grant", error_description: "Invalid refresh token" }),
    } as any);

    await expect(useSpotifyAuthStore.getState().getValidAccessToken()).rejects.toThrow("Invalid refresh token");

    // Revocation handling triggers disconnect(), preventing zombie connected state
    expect(useSpotifyAuthStore.getState().status).toBe("disconnected");
    expect(useSpotifyAuthStore.getState().tokens).toBeNull();
  });
});

describe("Adversarial Suite 3: Simulated 429 Rate Limit Bursts & Retry Exhaustion", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("recovers from 3 consecutive 429 bursts with valid Retry-After headers", async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts <= 3) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "0.01" }), // 10ms
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "resilient_token",
          expires_in: 3600,
        }),
      } as any;
    });

    const refreshed = await refreshTokens("valid_token");
    expect(refreshed.accessToken).toBe("resilient_token");
    expect(attempts).toBe(4); // 1 initial + 3 retries
  });

  it("exhausts retries on persistent 429 and throws Error with status 429", async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      return {
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "0.005" }),
        text: async () => JSON.stringify({ error: "Rate limit exceeded" }),
      } as any;
    });

    await expect(refreshTokens("valid_token")).rejects.toThrow();
    // maxRetries is 3, so attempts should be 1 initial + 3 retries = 4
    expect(attempts).toBe(4);
  });

  it("handles malformed or HTTP Date Retry-After header without throwing NaN delay crash", async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return {
          ok: false,
          status: 429,
          // HTTP-date format as per RFC 7231
          headers: new Headers({ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }),
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "survived_malformed_retry_after",
          expires_in: 3600,
        }),
      } as any;
    });

    const res = await refreshTokens("token_test");
    expect(res.accessToken).toBe("survived_malformed_retry_after");
    expect(attempts).toBe(2);
  });

  it("honors AbortSignal immediately during 429 backoff sleep", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      // Abort halfway through
      setTimeout(() => controller.abort(), 20);
      return {
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "5" }), // 5 seconds delay requested
      } as any;
    });

    const start = Date.now();
    await expect(
      refreshTokens("token", { signal: controller.signal })
    ).rejects.toThrow();
    const elapsed = Date.now() - start;

    // Should abort within < 500ms, NOT sleep for 5000ms
    expect(elapsed).toBeLessThan(500);
  });

  it("throws with status 429 on fetchUserPlaylists exhaustion", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "0.005" }),
    }));

    await expect(fetchUserPlaylists("token")).rejects.toThrow(/Failed to fetch playlists: HTTP 429/);
  });

  it("throws with status 429 on fetchSpotifyUserPlaylistTracks exhaustion", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "0.005" }),
    }));

    await expect(fetchSpotifyUserPlaylistTracks("pl_1", "token")).rejects.toThrow(/Failed to fetch playlist tracks: HTTP 429/);
  });
});

describe("Adversarial Suite 4: Paginated Playlists (1000+ Tracks) & Corrupted Payloads", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("successfully streams 1,250 tracks across 13 pages without off-by-one or infinite loop", async () => {
    const TOTAL_TRACKS = 1250;
    const PAGE_SIZE = 100;
    let pagesRequested = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      pagesRequested++;
      const urlObj = new URL(url);
      const offset = Number(urlObj.searchParams.get("offset") || "0");
      const limit = Number(urlObj.searchParams.get("limit") || "100");

      const itemsCount = Math.min(limit, Math.max(0, TOTAL_TRACKS - offset));
      const items = [];
      for (let i = 0; i < itemsCount; i++) {
        const id = offset + i;
        items.push({
          track: {
            id: `trk_${id}`,
            name: `Track #${id}`,
            artists: [{ name: `Artist ${id % 10}` }],
            album: { name: `Album ${id % 5}`, images: [{ url: `https://art/${id}.jpg` }] },
            duration_ms: 180000 + id,
          },
        });
      }

      const next = offset + itemsCount < TOTAL_TRACKS ? `https://api.spotify.com/v1/playlists/p1/tracks?offset=${offset + itemsCount}` : null;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          total: TOTAL_TRACKS,
          limit,
          offset,
          next,
          items,
        }),
      } as any;
    });

    const tracks = await fetchSpotifyUserPlaylistTracks("big_playlist", "valid_token");
    expect(tracks).toHaveLength(TOTAL_TRACKS);
    expect(pagesRequested).toBe(13); // ceil(1250 / 100) = 13 pages
    expect(tracks[0].title).toBe("Track #0");
    expect(tracks[1249].title).toBe("Track #1249");
  });

  it("resiliently filters corrupted, null, missing, and adversarial track structures", async () => {
    const malformedItems = [
      null, // corrupted null item
      undefined, // corrupted undefined
      {}, // empty object without track
      { track: null }, // Spotify deleted track
      { is_local: true, track: { id: "loc_1", name: "Local file.mp3" } }, // local file flag on item
      { track: { id: "loc_2", name: "Local 2", is_local: true } }, // local file flag on track
      { track: { id: "ep_1", name: "Podcast episode", type: "episode" } }, // podcast episode
      { track: { id: "blank_1", name: "" } }, // empty title
      { track: { id: "blank_2", name: "   \t\n  " } }, // whitespace-only title
      {
        // Missing artists array
        track: {
          id: "no_artists",
          name: "Solo Instrument",
          artists: null,
          album: null,
          duration_ms: 120000,
        },
      },
      {
        // Corrupted artists with null and non-string elements
        track: {
          id: "corrupted_artists",
          name: "Crazy Feat",
          artists: [null, undefined, { name: null }, { name: "   " }, { name: "Valid Artist" }],
          album: { name: "Album Name", images: [] },
          duration_ms: 200000,
        },
      },
      {
        // Missing album images
        track: {
          id: "no_images",
          name: "No Image Track",
          artists: [{ name: "Singer" }],
          album: { name: "Artless", images: null },
          duration_ms: 150000,
        },
      },
      {
        // Album images with empty or invalid url
        track: {
          id: "invalid_images",
          name: "Bad Art Track",
          artists: [{ name: "Singer" }],
          album: { name: "Artless", images: [{}, { url: null }, { url: "https://art/valid.jpg" }] },
          duration_ms: 150000,
        },
      },
      {
        // Track with uri fallback but missing id
        track: {
          id: null,
          uri: "spotify:track:fallback_id_999",
          name: "Fallback URI Song",
          artists: [{ name: "Fallback Artist" }],
          duration_ms: 190000,
        },
      },
      {
        // Non-number duration_ms
        track: {
          id: "weird_dur",
          name: "Duration Glitch",
          artists: [{ name: "Glitch" }],
          duration_ms: "invalid_string_duration",
        },
      },
      {
        // Pristine normal track
        track: {
          id: "pristine_1",
          name: "Perfect Song",
          artists: [{ name: "Star", id: "art_star" }],
          album: { name: "Masterpiece", id: "alb_1", images: [{ url: "https://art/perfect.jpg" }] },
          duration_ms: 240000,
        },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: malformedItems.length,
        items: malformedItems,
        next: null,
      }),
    } as any);

    const result = await fetchSpotifyUserPlaylistTracks("corrupt_playlist", "valid_token");

    // Only valid tracks should survive:
    // 1. no_artists (with fallback "Spotify Artist")
    // 2. corrupted_artists (filtered to ["Valid Artist"])
    // 3. no_images (coverUrl undefined)
    // 4. invalid_images
    // 5. weird_dur (durationMs omitted)
    // 6. fallback_id_999 (sourceId resolved from uri)
    // 7. pristine_1
    const ids = result.map((t) => t.sourceId);
    expect(ids).toContain("pristine_1");
    expect(ids).toContain("fallback_id_999");
    expect(ids).toContain("no_artists");
    expect(ids).toContain("corrupted_artists");

    // Episodes, local files, and blank names MUST NOT exist
    expect(ids).not.toContain("loc_1");
    expect(ids).not.toContain("loc_2");
    expect(ids).not.toContain("ep_1");
    expect(ids).not.toContain("blank_1");
    expect(ids).not.toContain("blank_2");

    const fallbackSong = result.find((t) => t.sourceId === "fallback_id_999");
    expect(fallbackSong?.sourceId).toBe("fallback_id_999");

    const noArtistsSong = result.find((t) => t.sourceId === "no_artists");
    expect(noArtistsSong?.artists).toEqual(["Spotify Artist"]);

    const corruptedArtistSong = result.find((t) => t.sourceId === "corrupted_artists");
    expect(corruptedArtistSong?.artists).toEqual(["Valid Artist"]);
  });

  it("handles pagination response where items is unexpectedly empty or not an array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 100,
        items: null, // corrupted payload
      }),
    } as any);

    const tracks = await fetchSpotifyUserPlaylistTracks("pl_empty_items", "valid_token");
    expect(tracks).toEqual([]);
  });

  it("handles user playlists pagination with 250 playlists across 5 pages", async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      call++;
      const urlObj = new URL(url);
      const offset = Number(urlObj.searchParams.get("offset") || "0");
      const limit = Number(urlObj.searchParams.get("limit") || "50");

      const items = [];
      for (let i = 0; i < limit; i++) {
        const id = offset + i;
        items.push({
          id: `playlist_${id}`,
          name: `User Playlist ${id}`,
          description: i % 2 === 0 ? `Desc ${id}` : null,
          images: [{ url: `https://img/${id}.png` }],
          tracks: { total: 50 },
          public: true,
          owner: { display_name: "Owner" },
        });
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          total: 250,
          limit,
          offset,
          next: offset + limit < 250 ? `https://api.spotify.com/v1/me/playlists?offset=${offset + limit}` : null,
          items,
        }),
      } as any;
    });

    const playlists = await fetchUserPlaylists("token");
    expect(playlists).toHaveLength(250);
    expect(call).toBe(5);
    expect(playlists[0].id).toBe("playlist_0");
    expect(playlists[249].id).toBe("playlist_249");
  });
});
