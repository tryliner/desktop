import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  rememberSoundCloudClientId,
  resetSoundCloudClientIdCache,
} from "./soundcloudClientId";
import { searchSoundCloudTracks } from "./soundcloudSearch";

const USER = { id: 7, username: "nuvole" };

function track(id: number, extra: Record<string, unknown> = {}) {
  return { id, title: `Song ${id}`, duration: 180_000, user: USER, ...extra };
}

function stubSearch(collection: unknown[]) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return url.pathname === "/search/tracks"
      ? new Response(JSON.stringify({ collection }), { status: 200 })
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

describe("searchSoundCloudTracks", () => {
  it("maps playable tracks into catalog search hits", async () => {
    const spy = stubSearch([
      track(1, {
        policy: "ALLOW",
        playback_count: 42,
        publisher_metadata: { artist: "Nuvole" },
      }),
    ]);
    const hits = await searchSoundCloudTracks("song");
    expect(hits).toEqual([
      {
        track: expect.objectContaining({
          type: "track",
          id: "sc:1",
          title: "Song 1",
          artists: [{ id: "sc_user_7", name: "nuvole" }],
        }),
        uploader: "nuvole",
        publisherArtist: "Nuvole",
        plays: 42,
      },
    ]);
    const url = new URL(String(spy.mock.calls[0][0]));
    expect(url.searchParams.get("q")).toBe("song");
  });

  it("skips previews, blocked and unstreamable tracks", async () => {
    stubSearch([
      track(1, { policy: "SNIP" }),
      track(2, { policy: "BLOCK" }),
      track(3, { streamable: false }),
      track(4, { policy: "MONETIZE" }),
    ]);
    const hits = await searchSoundCloudTracks("song");
    expect(hits.map((hit) => hit.track.id)).toEqual(["sc:4"]);
  });
});
