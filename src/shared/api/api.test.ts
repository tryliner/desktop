import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveSnapshot = vi.fn();

vi.mock("./clientCatalog", () => ({
  clientCatalog: { resolveSnapshot: (id: string) => resolveSnapshot(id) },
}));
vi.mock("./requestSigner", () => ({
  signApiRequest: async () => ({}),
  syncServerTime: () => undefined,
}));
vi.mock("./auth-session", () => ({
  getAuthSession: () => ({ accessToken: "token" }),
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

import { api, ApiError } from "./api";

const track = {
  id: "dQw4w9WgXcQ",
  title: "Song",
  artists: [{ id: null, name: "Artist" }],
  durationMs: 0,
};

const playlist = {
  id: "7a1f0e7e-3b7c-4c55-9a43-1f1c4ab8e0de",
  ownerId: "7a1f0e7e-3b7c-4c55-9a43-1f1c4ab8e0df",
  title: "Mine",
  description: null,
  isPublic: false,
  revision: 2,
  trackCount: 1,
  durationMs: 0,
  coverUrls: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

const fetchMock = vi.fn();

function reply(status: number, body?: unknown, headers?: HeadersInit) {
  fetchMock.mockImplementationOnce(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers,
      }),
  );
}

function sent(call = 0): { url: string; method?: string; body: unknown } {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return {
    url,
    method: init.method,
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

describe("api", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    fetchMock.mockReset();
    resolveSnapshot.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("likes a track with { track } only, unknown duration as null", async () => {
    resolveSnapshot.mockResolvedValue(track);
    reply(204);
    await api.likeTrack(track.id);
    expect(sent()).toEqual({
      url: `https://api.test/v1/me/library/tracks/${track.id}`,
      method: "PUT",
      body: { track: { ...track, durationMs: null } },
    });
  });

  it("likes without a body when the client catalog does not know the track", async () => {
    resolveSnapshot.mockResolvedValue(undefined);
    reply(404, {
      statusCode: 404,
      error: "Not Found",
      code: "TRACK_UNKNOWN",
      message: "This track is unknown; send its metadata with the request.",
    });
    const error = await api.likeTrack(track.id).catch((err) => err);
    expect(sent().body).toBeUndefined();
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "TRACK_UNKNOWN" });
  });

  it("adds a track to a playlist with { track } only", async () => {
    resolveSnapshot.mockResolvedValue(track);
    reply(201, { id: "item", track, addedAt: "2026-10-03T00:00:00.000Z" });
    await api.addPlaylistTrack(playlist.id, track.id);
    expect(sent().body).toEqual({ track: { ...track, durationMs: null } });
  });

  it("reads a playlist page without compact and keeps the details shape", async () => {
    const details = {
      playlist,
      owner: {
        id: playlist.ownerId,
        username: "me",
        displayName: null,
        avatarUrl: null,
      },
      items: [],
      nextCursor: "next",
    };
    reply(200, details);
    expect(await api.readUserPlaylist(playlist.id, { limit: 100 })).toEqual({
      notModified: false,
      etag: undefined,
      ...details,
    });
    expect(sent().url).toBe(
      `https://api.test/v1/me/playlists/${playlist.id}?limit=100`,
    );

    reply(200, { ...details, nextCursor: null }, { etag: '"e1"' });
    expect(await api.readUserPlaylist(playlist.id)).toMatchObject({
      etag: '"e1"',
      nextCursor: null,
    });
    expect(sent(1).url).toBe(`https://api.test/v1/me/playlists/${playlist.id}`);
  });

  it("treats a playlist item that is already gone as removed", async () => {
    reply(404, {
      statusCode: 404,
      error: "Not Found",
      code: "ITEM_NOT_FOUND",
      message: "No such item.",
    });
    await expect(
      api.removePlaylistItem(playlist.id, "item"),
    ).resolves.toBeUndefined();

    reply(404, {
      statusCode: 404,
      error: "Not Found",
      code: "PLAYLIST_NOT_FOUND",
      message: "No such playlist.",
    });
    await expect(
      api.removePlaylistItem(playlist.id, "item"),
    ).rejects.toMatchObject({ code: "PLAYLIST_NOT_FOUND" });
  });

  it("saves a collection with its typed snapshot", async () => {
    reply(204);
    await api.saveCollection("artists", "UC1", { name: "SZA" });
    expect(sent()).toMatchObject({
      url: "https://api.test/v1/me/library/artists/UC1",
      method: "PUT",
      body: { snapshot: { name: "SZA" } },
    });
  });
});
