import type { Track } from "@/shared/types";

export interface SpotifyOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface SpotifyUserPlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  images: { url: string }[];
  tracksCount: number;
  isPublic: boolean;
  ownerName: string;
  spotifyUrl: string;
}

export interface RawSpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id?: string }>;
  album?: {
    name: string;
    images?: Array<{ url: string; width?: number; height?: number }>;
  };
  duration_ms: number;
  external_ids?: { isrc?: string };
  uri?: string;
}

export interface SpotifyOAuthClient {
  generateAuthorizeUrl(): Promise<{ url: string; codeVerifier: string; state: string }>;
  exchangeCode(code: string, codeVerifier: string): Promise<SpotifyOAuthTokens>;
  refreshTokens(refreshToken: string): Promise<SpotifyOAuthTokens>;
  getUserPlaylists(accessToken: string): Promise<SpotifyUserPlaylistSummary[]>;
}

export interface SpotifyMockConfig {
  simulateRateLimit?: boolean;
  retryAfterSeconds?: number;
  simulateAuthError?: boolean;
  simulateNetworkError?: boolean;
}

export class MockSpotifyService implements SpotifyOAuthClient {
  private config: SpotifyMockConfig;
  private callCount: number = 0;
  private tokens: Map<string, SpotifyOAuthTokens> = new Map();
  private userPlaylists: SpotifyUserPlaylistSummary[] = [];

  constructor(config: SpotifyMockConfig = {}) {
    this.config = config;
    this.seedDefaultPlaylists();
  }

  public updateConfig(config: Partial<SpotifyMockConfig>) {
    this.config = { ...this.config, ...config };
  }

  public getCallCount(): number {
    return this.callCount;
  }

  public resetCallCount(): void {
    this.callCount = 0;
  }

  private seedDefaultPlaylists() {
    this.userPlaylists = [
      {
        id: "sp_pl_001",
        name: "Morning Acoustic Vibes",
        description: "Soft acoustic melodies to start the morning right",
        images: [{ url: "https://images.spotify.com/art/001.jpg" }],
        tracksCount: 25,
        isPublic: true,
        ownerName: "test_user",
        spotifyUrl: "https://open.spotify.com/playlist/sp_pl_001",
      },
      {
        id: "sp_pl_002",
        name: "Synthwave Coding Session",
        description: "Retro electronic beats for late night hacking",
        images: [{ url: "https://images.spotify.com/art/002.jpg" }],
        tracksCount: 42,
        isPublic: false,
        ownerName: "test_user",
        spotifyUrl: "https://open.spotify.com/playlist/sp_pl_002",
      },
      {
        id: "sp_pl_003",
        name: "Lo-Fi Study Chill",
        description: "Beats to relax/study to",
        images: [{ url: "https://images.spotify.com/art/003.jpg" }],
        tracksCount: 18,
        isPublic: true,
        ownerName: "test_user",
        spotifyUrl: "https://open.spotify.com/playlist/sp_pl_003",
      },
    ];
  }

  public async generateAuthorizeUrl(): Promise<{ url: string; codeVerifier: string; state: string }> {
    const codeVerifier = "mock_verifier_" + Math.random().toString(36).substring(2, 15);
    const state = "state_" + Math.random().toString(36).substring(2, 10);
    const challenge = "challenge_" + codeVerifier.slice(0, 8);
    const url = `https://accounts.spotify.com/authorize?client_id=liner_mock_id&response_type=code&redirect_uri=liner%3A%2F%2Fspotify-callback&code_challenge=${challenge}&code_challenge_method=S256&state=${state}&scope=playlist-read-private%20playlist-read-collaborative`;
    return { url, codeVerifier, state };
  }

  public async exchangeCode(code: string, codeVerifier: string): Promise<SpotifyOAuthTokens> {
    this.callCount++;
    if (this.config.simulateNetworkError) {
      throw new Error("NetworkError: Failed to reach accounts.spotify.com");
    }
    if (this.config.simulateRateLimit) {
      const err = new Error("Rate limit exceeded") as Error & { status?: number; retryAfter?: number };
      err.status = 429;
      err.retryAfter = this.config.retryAfterSeconds ?? 2;
      throw err;
    }
    if (this.config.simulateAuthError || !code || !codeVerifier) {
      const err = new Error("invalid_grant: Invalid authorization code or verifier") as Error & { status?: number };
      err.status = 400;
      throw err;
    }

    const tokens: SpotifyOAuthTokens = {
      accessToken: "mock_access_token_" + Math.random().toString(36).substring(2),
      refreshToken: "mock_refresh_token_" + Math.random().toString(36).substring(2),
      expiresAt: Date.now() + 3600 * 1000,
      scope: "playlist-read-private playlist-read-collaborative",
      tokenType: "Bearer",
    };
    this.tokens.set(tokens.accessToken, tokens);
    return tokens;
  }

  public async refreshTokens(refreshToken: string): Promise<SpotifyOAuthTokens> {
    this.callCount++;
    if (!refreshToken || refreshToken.includes("invalid")) {
      const err = new Error("invalid_grant: Invalid refresh token") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    const newTokens: SpotifyOAuthTokens = {
      accessToken: "mock_refreshed_access_" + Math.random().toString(36).substring(2),
      refreshToken: refreshToken,
      expiresAt: Date.now() + 3600 * 1000,
      scope: "playlist-read-private playlist-read-collaborative",
      tokenType: "Bearer",
    };
    this.tokens.set(newTokens.accessToken, newTokens);
    return newTokens;
  }

  public async getUserPlaylists(accessToken: string): Promise<SpotifyUserPlaylistSummary[]> {
    this.callCount++;
    if (this.config.simulateRateLimit) {
      const err = new Error("Rate limit exceeded") as Error & { status?: number; retryAfter?: number };
      err.status = 429;
      err.retryAfter = this.config.retryAfterSeconds ?? 2;
      throw err;
    }
    if (!accessToken || accessToken.includes("expired") || (!this.tokens.has(accessToken) && !accessToken.startsWith("mock_access_token_"))) {
      const err = new Error("The access token expired") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    return [...this.userPlaylists];
  }

  public parseSpotifyUrl(input: string): { type: "playlist" | "album" | "track"; id: string } | null {
    if (!input || typeof input !== "string") return null;
    const trimmed = input.trim();

    // Direct ID (22 chars base62 alphanumeric)
    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
      return { type: "playlist", id: trimmed };
    }

    // URI format: spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
    const uriMatch = trimmed.match(/^spotify:(playlist|album|track):([a-zA-Z0-9]+)$/);
    if (uriMatch) {
      return { type: uriMatch[1] as "playlist" | "album" | "track", id: uriMatch[2] };
    }

    // URL format: https://open.spotify.com/(embed/)?(playlist|album|track)/{id}
    try {
      const url = new URL(trimmed);
      if (url.hostname === "open.spotify.com" || url.hostname === "spotify.link") {
        const segments = url.pathname.split("/").filter(Boolean);
        const typeIndex = segments[0] === "embed" ? 1 : 0;
        const type = segments[typeIndex];
        const id = segments[typeIndex + 1]?.split("?")[0];
        if ((type === "playlist" || type === "album" || type === "track") && id) {
          return { type, id };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  public async fetchPublicPlaylist(id: string): Promise<{
    id: string;
    title: string;
    description: string;
    coverUrl: string;
    tracks: RawSpotifyTrack[];
  }> {
    this.callCount++;
    if (this.config.simulateRateLimit) {
      const err = new Error("Rate limit exceeded") as Error & { status?: number; retryAfter?: number };
      err.status = 429;
      err.retryAfter = this.config.retryAfterSeconds ?? 2;
      throw err;
    }

    if (id === "empty_playlist") {
      return {
        id,
        title: "Empty Collection",
        description: "No tracks here",
        coverUrl: "https://images.spotify.com/art/empty.jpg",
        tracks: [],
      };
    }

    if (id === "invalid_id" || id === "not_found") {
      const err = new Error("Resource not found") as Error & { status?: number };
      err.status = 404;
      throw err;
    }

    // Default mock playlist tracks
    const rawTracks: RawSpotifyTrack[] = [
      {
        id: "sp_t_01",
        name: "Starlight Drive",
        artists: [{ name: "Neon Horizon" }, { name: "Retro Wave" }],
        album: {
          name: "Midnight Outrun",
          images: [{ url: "https://images.spotify.com/album/midnight.jpg", width: 640, height: 640 }],
        },
        duration_ms: 214000,
        external_ids: { isrc: "USABC2600001" },
      },
      {
        id: "sp_t_02",
        name: "Electric Dreams",
        artists: [{ name: "Cyber Sunset" }],
        album: {
          name: "Neon City Lights",
          images: [{ url: "https://images.spotify.com/album/neon.jpg", width: 640, height: 640 }],
        },
        duration_ms: 182000,
        external_ids: { isrc: "USABC2600002" },
      },
      {
        id: "sp_t_03",
        name: "Acoustic Sunset",
        artists: [{ name: "Folk Strings" }],
        album: {
          name: "Wooden Cabin Sessions",
          images: [{ url: "https://images.spotify.com/album/cabin.jpg", width: 640, height: 640 }],
        },
        duration_ms: 245000,
        external_ids: { isrc: "USABC2600003" },
      },
    ];

    return {
      id,
      title: "Discover Weekly Mock",
      description: "Curated mock tracks for testing",
      coverUrl: "https://images.spotify.com/art/discover.jpg",
      tracks: rawTracks,
    };
  }

  public normalizeTrack(raw: RawSpotifyTrack): Track {
    return {
      id: `spotify:${raw.id}`,
      title: raw.name || "Untitled Track",
      artists: raw.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
      album: raw.album?.name,
      durationMs: raw.duration_ms || 0,
      coverUrl: raw.album?.images?.[0]?.url || "",
      isrc: raw.external_ids?.isrc,
      playCount: 0,
    };
  }
}
