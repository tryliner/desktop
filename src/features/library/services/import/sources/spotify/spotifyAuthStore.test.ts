import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useSpotifyAuthStore, STORAGE_KEY_TOKENS, STORAGE_KEY_PENDING_PKCE } from "./spotifyAuthStore";
import * as spotifyOAuth from "./spotifyOAuth";

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

describe("Spotify Auth Store", () => {
  beforeEach(() => {
    globalThis.localStorage = createMockStorage();
    useSpotifyAuthStore.getState().disconnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with disconnected status when no tokens stored", () => {
    const state = useSpotifyAuthStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.tokens).toBeNull();
  });

  it("initiateAuth sets connecting status and saves pending PKCE", async () => {
    const authUrl = await useSpotifyAuthStore.getState().initiateAuth();

    expect(authUrl).toContain("https://accounts.spotify.com/authorize");
    const state = useSpotifyAuthStore.getState();
    expect(state.status).toBe("connecting");
    expect(state.pendingPkce).not.toBeNull();
    expect(state.pendingPkce?.codeVerifier).toBeDefined();

    const storedPkce = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY_PENDING_PKCE)!);
    expect(storedPkce.state).toBe(state.pendingPkce?.state);
  });

  it("handleCallback exchanges code, clears PKCE, and transitions to connected", async () => {
    await useSpotifyAuthStore.getState().initiateAuth();
    const pendingState = useSpotifyAuthStore.getState().pendingPkce!.state;

    vi.spyOn(spotifyOAuth, "exchangeCode").mockResolvedValueOnce({
      accessToken: "mock_acc_token",
      refreshToken: "mock_ref_token",
      expiresAt: Date.now() + 3600 * 1000,
      scope: "playlist-read-private",
      tokenType: "Bearer",
    });

    const tokens = await useSpotifyAuthStore.getState().handleCallback(
      `liner://spotify-callback?code=mock_code_123&state=${pendingState}`
    );

    expect(tokens.accessToken).toBe("mock_acc_token");
    const state = useSpotifyAuthStore.getState();
    expect(state.status).toBe("connected");
    expect(state.tokens?.accessToken).toBe("mock_acc_token");
    expect(state.pendingPkce).toBeNull();
    expect(globalThis.localStorage.getItem(STORAGE_KEY_PENDING_PKCE)).toBeNull();

    const storedTokens = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY_TOKENS)!);
    expect(storedTokens.accessToken).toBe("mock_acc_token");
  });

  it("getValidAccessToken returns existing token if still valid (>60s left)", async () => {
    const validTokens = {
      accessToken: "current_valid_token",
      refreshToken: "ref_123",
      expiresAt: Date.now() + 120_000, // 2 minutes remaining
      scope: "playlist-read-private",
      tokenType: "Bearer",
    };
    useSpotifyAuthStore.getState().setTokens(validTokens);

    const refreshSpy = vi.spyOn(spotifyOAuth, "refreshTokens");
    const token = await useSpotifyAuthStore.getState().getValidAccessToken();

    expect(token).toBe("current_valid_token");
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("getValidAccessToken auto-refreshes when within 60s buffer", async () => {
    const expiringTokens = {
      accessToken: "expiring_token",
      refreshToken: "ref_123",
      expiresAt: Date.now() + 30_000, // only 30s remaining
      scope: "playlist-read-private",
      tokenType: "Bearer",
    };
    useSpotifyAuthStore.getState().setTokens(expiringTokens);

    vi.spyOn(spotifyOAuth, "refreshTokens").mockResolvedValueOnce({
      accessToken: "new_refreshed_token",
      refreshToken: "ref_123",
      expiresAt: Date.now() + 3600_000,
      scope: "playlist-read-private",
      tokenType: "Bearer",
    });

    const token = await useSpotifyAuthStore.getState().getValidAccessToken();

    expect(token).toBe("new_refreshed_token");
    expect(useSpotifyAuthStore.getState().tokens?.accessToken).toBe("new_refreshed_token");
  });

  it("disconnect clears tokens, playlists, and resets state", () => {
    useSpotifyAuthStore.getState().setTokens({
      accessToken: "token_to_clear",
      refreshToken: "ref_to_clear",
      expiresAt: Date.now() + 3600_000,
      scope: "",
      tokenType: "Bearer",
    });

    useSpotifyAuthStore.getState().disconnect();

    const state = useSpotifyAuthStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.tokens).toBeNull();
    expect(state.playlists).toHaveLength(0);
    expect(globalThis.localStorage.getItem(STORAGE_KEY_TOKENS)).toBeNull();
  });
});
