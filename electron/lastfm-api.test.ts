// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  LastfmApi,
  lastfmSignature,
  validCredentials,
  validLastfmListen,
  validLastfmTrack,
} from "./lastfm-api";

const credentials = { apiKey: "a".repeat(32), secret: "b".repeat(32) };

describe("Last.fm API", () => {
  it("signs the raw UTF-8 values in ASCII key order, excluding format and callback", () => {
    const fields = {
      "artist[1]": "Björk & friends",
      "artist[10]": "宇多田",
      method: "track.scrobble",
      format: "json",
      callback: "cb",
      api_sig: "old",
    };
    const expected = createHash("md5")
      .update(
        "artist[10]宇多田artist[1]Björk & friendsmethodtrack.scrobblesecret",
        "utf8",
      )
      .digest("hex");
    expect(lastfmSignature(fields, "secret")).toBe(expected);
  });

  it("posts HTTPS form data with correctly escaped metadata and original timestamps", async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ scrobbles: {} })),
    );
    const api = new LastfmApi(fetch);
    await api.scrobble(
      credentials,
      "session",
      [
        {
          id: "play",
          artist: "Björk & friends",
          track: "A+B",
          duration: 180,
          timestamp: 1700000000,
          chosenByUser: 0,
        },
      ],
      new AbortController().signal,
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ws.audioscrobbler.com/2.0/");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("artist[0]")).toBe("Björk & friends");
    expect(body.get("track[0]")).toBe("A+B");
    expect(body.get("timestamp[0]")).toBe("1700000000");
    expect(body.get("chosenByUser[0]")).toBe("0");
    expect(body.has("id[0]")).toBe(false);
    expect(body.get("api_sig")).toBe(
      lastfmSignature(Object.fromEntries(body), credentials.secret),
    );
  });

  it.each([
    [200, { error: 9, message: "Invalid session" }, 9],
    [429, {}, 29],
    [503, {}, 16],
    [400, {}, 6],
    [200, [], 16],
  ])(
    "inspects both HTTP status %s and API errors",
    async (status, data, code) => {
      const api = new LastfmApi(
        vi.fn(async () => new Response(JSON.stringify(data), { status })),
      );
      await expect(
        api.request(credentials, "auth.getToken", {}),
      ).rejects.toMatchObject({ code });
    },
  );

  it("treats malformed JSON as a temporary failure and propagates cancellation", async () => {
    const api = new LastfmApi(
      vi.fn(async () => new Response("<html>unavailable</html>")),
    );
    await expect(
      api.request(credentials, "auth.getToken", {}),
    ).rejects.toMatchObject({ code: 16 });
    const fetch = vi.fn(async (_url, init) => {
      init.signal.throwIfAborted();
      return new Response("{}");
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      new LastfmApi(fetch).request(
        credentials,
        "auth.getToken",
        {},
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("validates IPC inputs without rejecting short tracks for Now Playing", () => {
    const track = { artist: "Artist", track: "Song", duration: 30 };
    const listen = {
      ...track,
      duration: 31,
      id: "play",
      timestamp: 1700000000,
    };
    expect(validLastfmTrack(track)).toBe(true);
    expect(validLastfmListen({ ...listen, duration: 30 })).toBe(false);
    expect(validLastfmListen(listen)).toBe(true);
    for (const bad of [
      null,
      {},
      { ...listen, duration: Infinity },
      { ...listen, timestamp: Date.now() },
      { ...listen, artist: " " },
      { ...listen, chosenByUser: 2 },
      { ...listen, id: {} },
    ])
      expect(validLastfmListen(bad)).toBe(false);
    expect(validCredentials(credentials)).toBe(true);
    expect(validCredentials({ apiKey: "key", secret: "secret" })).toBe(false);
  });
});
