import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberSoundCloudClientId, resetSoundCloudClientIdCache } from "./soundcloudClientId";
import { searchSoundCloud } from "./soundcloudSearch";

const USER = {
  id: 42,
  username: "label-upload",
  avatar_url: "https://i1.sndcdn.com/avatars-x-large.jpg",
  permalink_url: "https://soundcloud.com/label-upload",
};

function track(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Song ${id}`,
    duration: 1000 * id,
    artwork_url: `https://i1.sndcdn.com/artworks-${id}-large.jpg`,
    permalink_url: `https://soundcloud.com/label-upload/song-${id}`,
    user: USER,
    ...extra,
  };
}

function set(id: number, isAlbum: boolean, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: isAlbum ? `Album ${id}` : `Mix ${id}`,
    is_album: isAlbum,
    set_type: isAlbum ? "album" : "",
    permalink_url: `https://soundcloud.com/label-upload/sets/set-${id}`,
    user: USER,
    ...extra,
  };
}

function installFetch(
  collections: Partial<Record<"/search/tracks" | "/search/users" | "/search/playlists", unknown[]>>,
) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const collection = collections[url.pathname as keyof typeof collections];
    return collection
      ? new Response(JSON.stringify({ collection }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      : new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  resetSoundCloudClientIdCache();
  rememberSoundCloudClientId("c".repeat(32));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchSoundCloud", () => {
  it("searches tracks with q and maps sc IDs, source, uploader, and permalink", async () => {
    const spy = installFetch({ "/search/tracks": [track(7)] });

    await expect(searchSoundCloud("weeknd", "track")).resolves.toEqual([
      expect.objectContaining({
        type: "track",
        id: "sc:7",
        source: "soundcloud",
        externalUrl: "https://soundcloud.com/label-upload/song-7",
        artists: [{ id: "sc_user_42", name: "label-upload" }],
      }),
    ]);

    const url = new URL(String(spy.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/search/tracks");
    expect(url.searchParams.get("q")).toBe("weeknd");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("searches users for artist and maps sc_user IDs", async () => {
    installFetch({ "/search/users": [USER] });

    await expect(searchSoundCloud("weeknd", "artist")).resolves.toEqual([
      expect.objectContaining({
        type: "artist",
        id: "sc_user_42",
        name: "label-upload",
        source: "soundcloud",
        externalUrl: "https://soundcloud.com/label-upload",
      }),
    ]);
  });

  it("returns only album-like sets for album search", async () => {
    installFetch({ "/search/playlists": [set(1, true), set(2, false)] });

    const results = await searchSoundCloud("weeknd", "album");

    expect(results).toEqual([
      expect.objectContaining({ type: "album", id: "sc_playlist_1", source: "soundcloud" }),
    ]);
  });

  it("returns only ordinary sets for playlist search", async () => {
    installFetch({ "/search/playlists": [set(1, true), set(2, false)] });

    const results = await searchSoundCloud("weeknd", "playlist");

    expect(results).toEqual([
      expect.objectContaining({ type: "playlist", id: "sc_playlist_2", source: "soundcloud" }),
    ]);
  });

  it("combines tracks, users, albums, and playlists for all without duplicates", async () => {
    installFetch({
      "/search/tracks": [track(1), track(1), track(2)],
      "/search/users": [USER, USER],
      "/search/playlists": [set(3, true), set(4, false), set(4, false)],
    });

    const results = await searchSoundCloud("weeknd");

    expect(results.map(({ type, id }) => `${type}:${id}`)).toEqual([
      "track:sc:1",
      "track:sc:2",
      "artist:sc_user_42",
      "album:sc_playlist_3",
      "playlist:sc_playlist_4",
    ]);
  });

  it("reserves All results for every SoundCloud entity type", async () => {
    installFetch({
      "/search/tracks": Array.from({ length: 20 }, (_, index) => track(index + 1)),
      "/search/users": [USER],
      "/search/playlists": [set(101, true), set(102, false)],
    });

    const results = await searchSoundCloud("weeknd");
    const resultIds = results.map(({ type, id }) => `${type}:${id}`);

    expect(results).toHaveLength(13);
    expect(resultIds).toContain("artist:sc_user_42");
    expect(resultIds).toContain("album:sc_playlist_101");
    expect(resultIds).toContain("playlist:sc_playlist_102");
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("forwards AbortSignal to every provider request", async () => {
    const spy = installFetch({
      "/search/tracks": [],
      "/search/users": [],
      "/search/playlists": [],
    });
    const controller = new AbortController();

    await searchSoundCloud("weeknd", "all", controller.signal);

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls.every(([, init]) => init?.signal === controller.signal)).toBe(true);
  });

  it("skips malformed collection records without rejecting valid neighbors", async () => {
    installFetch({
      "/search/tracks": [{ id: 1 }, null, track(2)],
    });

    await expect(searchSoundCloud("weeknd", "track")).resolves.toEqual([
      expect.objectContaining({ id: "sc:2" }),
    ]);
  });

  it("drops non-HTTPS and non-SoundCloud external URLs", async () => {
    installFetch({
      "/search/tracks": [
        track(1, { permalink_url: "http://soundcloud.com/u/insecure" }),
        track(2, { permalink_url: "https://example.com/not-soundcloud" }),
      ],
    });

    const results = await searchSoundCloud("weeknd", "track");

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.externalUrl === undefined)).toBe(true);
  });
});
