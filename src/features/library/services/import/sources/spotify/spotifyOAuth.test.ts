import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateAuthorizeUrl,
  exchangeCode,
  refreshTokens,
  fetchUserPlaylists,
  fetchSpotifyUserPlaylistTracks,
  parseRetryAfterHeader,
  normalizeSpotifyUserPlaylist,
  normalizeSpotifyTrack,
  SpotifyOAuthClientImpl,
  type RawSpotifyTrack,
  type SpotifyUserPlaylistSummary,
} from "./spotifyOAuth";

describe("Spotify OAuth PKCE & Web Crypto", () => {
  it("generates a random code verifier of requested length", () => {
    const verifier1 = generateCodeVerifier(64);
    const verifier2 = generateCodeVerifier(64);

    expect(verifier1).toHaveLength(64);
    expect(verifier2).toHaveLength(64);
    expect(verifier1).not.toBe(verifier2);
    expect(/^[A-Za-z0-9\-._~]+$/.test(verifier1)).toBe(true);
  });

  it("generates a valid SHA-256 base64url-encoded code challenge", async () => {
    // RFC 7636 test vector:
    // verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const testVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await generateCodeChallenge(testVerifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates state parameter", () => {
    const state = generateState(16);
    expect(state).toHaveLength(16);
    expect(/^[A-Za-z0-9]+$/.test(state)).toBe(true);
  });

  it("generates authorize URL with all required PKCE parameters", async () => {
    const { url, codeVerifier, state } = await generateAuthorizeUrl({
      clientId: "test_client_id",
      redirectUri: "liner://spotify-callback",
      scopes: ["playlist-read-private", "playlist-read-collaborative"],
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://accounts.spotify.com");
    expect(parsed.pathname).toBe("/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test_client_id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe("liner://spotify-callback");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("code_challenge")).toBeDefined();
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(parsed.searchParams.get("scope")).toBe("playlist-read-private playlist-read-collaborative");
    expect(codeVerifier).toBeDefined();
  });
});

describe("Spotify Token Exchange & Refresh", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("exchanges authorization code and verifier for tokens", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "sp_access_123",
        refresh_token: "sp_refresh_456",
        expires_in: 3600,
        scope: "playlist-read-private",
        token_type: "Bearer",
      }),
    } as any);

    const tokens = await exchangeCode("test_code", "test_verifier", { clientId: "test_client" });

    expect(tokens.accessToken).toBe("sp_access_123");
    expect(tokens.refreshToken).toBe("sp_refresh_456");
    expect(tokens.tokenType).toBe("Bearer");
    expect(tokens.scope).toBe("playlist-read-private");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now() + 3500 * 1000);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://accounts.spotify.com/api/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
  });

  it("throws on missing code or verifier", async () => {
    await expect(exchangeCode("", "verifier")).rejects.toThrow("invalid_grant");
    await expect(exchangeCode("code", "")).rejects.toThrow("invalid_grant");
  });

  it("throws on token exchange failure with response description", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error_description: "Invalid authorization code" }),
    } as any);

    await expect(exchangeCode("bad_code", "verifier")).rejects.toThrow("Invalid authorization code");
  });

  it("retries on HTTP 429 rate limit during exchange", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "0.01" }),
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "sp_retried_access",
          refresh_token: "sp_retried_refresh",
          expires_in: 3600,
        }),
      } as any;
    });

    const tokens = await exchangeCode("code", "verifier");
    expect(tokens.accessToken).toBe("sp_retried_access");
    expect(callCount).toBe(2);
  });

  it("refreshes tokens and preserves existing refresh token if omitted", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "sp_new_access_token",
        expires_in: 3600,
      }),
    } as any);

    const refreshed = await refreshTokens("existing_refresh_token_789");
    expect(refreshed.accessToken).toBe("sp_new_access_token");
    expect(refreshed.refreshToken).toBe("existing_refresh_token_789");
  });

  it("throws on invalid refresh token", async () => {
    // Missing token rejects immediately without dispatch
    await expect(refreshTokens("")).rejects.toThrow("invalid_grant");

    // Network mock returning standard Spotify 400 invalid_grant response
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid refresh token",
        }),
    } as any);

    await expect(refreshTokens("invalid_token")).rejects.toMatchObject({
      message: "invalid_grant: Invalid refresh token",
      status: 400,
      error: "invalid_grant",
      error_description: "Invalid refresh token",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://accounts.spotify.com/api/token",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("Spotify User Playlists & Tracks Fetching", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches user playlists with multi-page pagination", async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      call++;
      if (url.includes("offset=0")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            total: 2,
            items: [
              {
                id: "pl_01",
                name: "Playlist One",
                description: "Description 1",
                images: [{ url: "https://art/1.jpg" }],
                tracks: { total: 10 },
                public: true,
                owner: { display_name: "UserA" },
              },
            ],
          }),
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          total: 2,
          items: [
            {
              id: "pl_02",
              name: "Playlist Two",
              description: null,
              images: [],
              tracks: { total: 20 },
              public: false,
              owner: { id: "user_b" },
            },
          ],
        }),
      } as any;
    });

    const playlists = await fetchUserPlaylists("valid_token");
    expect(playlists).toHaveLength(2);
    expect(playlists[0]).toEqual({
      id: "pl_01",
      name: "Playlist One",
      description: "Description 1",
      images: [{ url: "https://art/1.jpg" }],
      tracksCount: 10,
      isPublic: true,
      ownerName: "UserA",
      spotifyUrl: "https://open.spotify.com/playlist/pl_01",
    });
    expect(playlists[1]).toEqual({
      id: "pl_02",
      name: "Playlist Two",
      description: null,
      images: [],
      tracksCount: 20,
      isPublic: false,
      ownerName: "user_b",
      spotifyUrl: "https://open.spotify.com/playlist/pl_02",
    });
  });

  it("throws 401 when access token is expired", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          status: 401,
          message: "The access token expired",
        },
      }),
    } as any);

    await expect(fetchUserPlaylists("expired_token")).rejects.toMatchObject({
      message: "The access token expired",
      status: 401,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.spotify.com/v1/me/playlists"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer expired_token" }),
      })
    );
  });

  it("throws 401 when access token is expired in fetchSpotifyUserPlaylistTracks", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          status: 401,
          message: "The access token expired",
        },
      }),
    } as any);

    await expect(fetchSpotifyUserPlaylistTracks("pl_123", "expired_token")).rejects.toMatchObject({
      message: "The access token expired",
      status: 401,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.spotify.com/v1/playlists/pl_123/tracks"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer expired_token" }),
      })
    );
  });

  it("throws 401 immediately on empty access token without network call", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    await expect(fetchUserPlaylists("")).rejects.toMatchObject({
      message: "The access token expired",
      status: 401,
    });
    await expect(fetchSpotifyUserPlaylistTracks("pl_123", "")).rejects.toMatchObject({
      message: "The access token expired",
      status: 401,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches playlist tracks filtering local files and episodes", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 4,
        items: [
          {
            track: {
              id: "t_01",
              name: "Valid Song",
              artists: [{ name: "Artist One", id: "a_01" }],
              album: { name: "Album One", id: "al_01", images: [{ url: "https://art/track.jpg" }] },
              duration_ms: 200000,
            },
          },
          {
            // Local track
            is_local: true,
            track: { id: "t_local", name: "Local MP3" },
          },
          {
            // Episode podcast
            track: { id: "ep_01", name: "Daily Podcast", type: "episode" },
          },
          {
            // Track with empty name
            track: { id: "t_blank", name: "   " },
          },
        ],
      }),
    } as any);

    const tracks = await fetchSpotifyUserPlaylistTracks("pl_123", "valid_token");
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toEqual({
      sourceId: "t_01",
      title: "Valid Song",
      artists: ["Artist One"],
      artistIds: ["a_01"],
      album: "Album One",
      albumId: "al_01",
      durationMs: 200000,
      coverUrl: "https://art/track.jpg",
    });
  });

  it("normalizes user playlist summary and tracks to ClientImportedPlaylist", () => {
    const summary: SpotifyUserPlaylistSummary = {
      id: "pl_summary",
      name: "My Chill List",
      description: "Smooth jazz",
      images: [{ url: "https://art/chill.jpg" }],
      tracksCount: 1,
      isPublic: true,
      ownerName: "DJ",
      spotifyUrl: "https://open.spotify.com/playlist/pl_summary",
    };

    const tracks = [
      {
        sourceId: "trk_1",
        title: "Night Drive",
        artists: ["Synth Master"],
        durationMs: 180000,
      },
    ];

    const result = normalizeSpotifyUserPlaylist(summary, tracks);
    expect(result.source).toBe("spotify");
    expect(result.title).toBe("My Chill List");
    expect(result.description).toBe("Smooth jazz");
    expect(result.sourceUrl).toBe("https://open.spotify.com/playlist/pl_summary");
    expect(result.tracks).toHaveLength(1);
  });

  it("normalizes raw track to canonical Track contract", () => {
    const raw: RawSpotifyTrack = {
      id: "raw_track_1",
      name: "Super Song",
      artists: [{ name: "Singer A" }, { name: "Singer B" }],
      album: {
        name: "Great Hits",
        images: [{ url: "https://art/greathits.jpg" }],
      },
      duration_ms: 215000,
      external_ids: { isrc: "USABC1234567" },
    };

    const normalized = normalizeSpotifyTrack(raw);
    expect(normalized).toEqual({
      id: "spotify:raw_track_1",
      title: "Super Song",
      artists: "Singer A, Singer B",
      album: "Great Hits",
      durationMs: 215000,
      coverUrl: "https://art/greathits.jpg",
      isrc: "USABC1234567",
      playCount: 0,
    });
  });

  it("SpotifyOAuthClientImpl implements full interface methods", async () => {
    const client = new SpotifyOAuthClientImpl({ clientId: "liner_mock_id" });
    const { url, codeVerifier, state } = await client.generateAuthorizeUrl();

    expect(url).toContain("https://accounts.spotify.com/authorize");
    expect(codeVerifier).toBeDefined();
    expect(state).toBeDefined();
  });
});

describe("parseRetryAfterHeader Rate Limit & Date Parsing", () => {
  it("parses integer and float delta-seconds clamped to bounds", () => {
    expect(parseRetryAfterHeader("2")).toBe(2000);
    expect(parseRetryAfterHeader("0.05")).toBe(100); // clamped to minDelayMs 100
    expect(parseRetryAfterHeader("15")).toBe(10000); // clamped to maxDelayMs 10000
    expect(parseRetryAfterHeader("5")).toBe(5000);
  });

  it("parses RFC 7231 IMF-fixdate HTTP-date without returning NaN", () => {
    const fixedNow = 1700000000000;
    const futureDate = new Date(fixedNow + 4000).toUTCString();
    expect(parseRetryAfterHeader(futureDate, 1000, 100, 10000, () => fixedNow)).toBe(4000);

    const pastDate = new Date(fixedNow - 2000).toUTCString();
    expect(parseRetryAfterHeader(pastDate, 1000, 100, 10000, () => fixedNow)).toBe(100);
  });

  it("returns default fallback for null, undefined, empty, or unparseable headers", () => {
    expect(parseRetryAfterHeader(null)).toBe(1000);
    expect(parseRetryAfterHeader(undefined)).toBe(1000);
    expect(parseRetryAfterHeader("   ")).toBe(1000);
    expect(parseRetryAfterHeader("invalid-header-value")).toBe(1000);
  });
});
