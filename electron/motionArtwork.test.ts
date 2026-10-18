import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, payload: unknown) => unknown>(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, payload: unknown) => unknown) => {
      mocks.handlers.set(channel, handler);
    },
  },
}));

import {
  MotionArtworkManager,
  extractMotionVideoUrls,
  isBlacklistedName,
  matchesArtists,
  normalizeName,
  scoreCandidate,
  splitArtistNames,
  type MotionArtworkFetchLike,
} from "./motionArtwork";

function makeToken(payload: Record<string, unknown>): string {
  const head = Buffer.from(JSON.stringify({ alg: "ES256", kid: "WebPlayKit" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${head}.${body}.sig`;
}

interface FakeRoute {
  urlIncludes: string;
  status?: number;
  headers?: Record<string, string>;
  body: string;
}

function fakeFetchImpl(routes: FakeRoute[], logTo?: string[]): MotionArtworkFetchLike {
  return (async (url: string) => {
    logTo?.push(url);
    const route = routes.find((entry) => url.includes(entry.urlIncludes));
    if (!route) throw new Error(`unexpected fetch: ${url}`);
    return {
      status: route.status ?? 200,
      ok: (route.status ?? 200) < 400,
      headers: { get: () => null },
      text: async () => route.body,
    };
  }) as MotionArtworkFetchLike;
}

const BROWSE_HTML = '<html><script src="/assets/index~abc123.js"></script></html>';

const FUTURE_TOKEN = makeToken({
  iss: "AMPWebPlay",
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
});

const SCRIPT_BODY = `window.config="${FUTURE_TOKEN}";`;

const SONG_ID = "1234567";
const ALBUM_ID = "9876543";

const SEARCH_BODY = JSON.stringify({
  results: {
    songs: {
      data: [
        {
          id: SONG_ID,
          type: "songs",
          attributes: {
            name: "Blinding Lights",
            artistName: "The Weeknd",
            collectionName: "After Hours (Deluxe)",
            url: `https://music.apple.com/us/album/after-hours-deluxe/${ALBUM_ID}?i=${SONG_ID}`,
          },
        },
      ],
    },
  },
});

const SONG_LOOKUP_BODY = JSON.stringify({
  data: [
    {
      id: SONG_ID,
      type: "songs",
      attributes: { name: "Blinding Lights", artistName: "The Weeknd" },
      relationships: { albums: { data: [{ id: ALBUM_ID }] } },
    },
  ],
});

const ALBUM_CANVAS_URL = "https://mvod.itunes.apple.com/some/canvas.m3u8";
const ALBUM_TALL_URL = "https://mvod.itunes.apple.com/some/canvas-tall.m3u8";

const ALBUM_BODY = JSON.stringify({
  data: [
    {
      id: ALBUM_ID,
      type: "albums",
      attributes: {
        name: "After Hours (Deluxe)",
        artistName: "The Weeknd",
        editorialVideo: {
          motionDetailSquare: { video: ALBUM_CANVAS_URL },
          motionDetailTall: { video: ALBUM_TALL_URL },
        },
      },
    },
  ],
});

const happyRoutes: FakeRoute[] = [
  { urlIncludes: "/us/browse", body: BROWSE_HTML },
  { urlIncludes: "/assets/index~abc123.js", body: SCRIPT_BODY },
  { urlIncludes: "/catalog/us/search", body: SEARCH_BODY },
  { urlIncludes: `/catalog/us/songs/${SONG_ID}`, body: SONG_LOOKUP_BODY },
  { urlIncludes: `/catalog/us/albums/${ALBUM_ID}`, body: ALBUM_BODY },
];

describe("normalizeName", () => {
  it("strips diacritics, punctuation and collapses spaces", () => {
    expect(normalizeName("Beyoncé — Crazy In Love (Remix)!")).toBe(
      "beyonce crazy in love remix"
    );
    expect(normalizeName("Beyoncé    Crazy")).toBe(normalizeName("Beyoncé Crazy"));
  });
});

describe("splitArtistNames / matchesArtists", () => {
  it("splits featured artists across delimiters", () => {
    expect(splitArtistNames("A & B ft. C")).toEqual(["a", "b", "c"]);
  });

  it("matches when every requested artist is present", () => {
    expect(matchesArtists("The Weeknd & Daft Punk", "Daft Punk, The Weeknd")).toBe(true);
    expect(matchesArtists("The Weeknd, Daft Punk", "The Weeknd")).toBe(false);
  });
});

describe("isBlacklistedName", () => {
  it("catches compilations and playlists", () => {
    expect(isBlacklistedName("Today's Hits: Essentials")).toBe(true);
    expect(isBlacklistedName("After Hours")).toBe(false);
  });
});

describe("scoreCandidate", () => {
  it("rewards exact name and album", () => {
    const score = scoreCandidate({
      requestedTitle: "Blinding Lights",
      requestedAlbum: "After Hours",
      resultName: "Blinding Lights",
      resultAlbumName: "After Hours",
    });
    expect(score).toBe(10 + 15 + 20);
  });

  it("rewards fuzzy name and album containment", () => {
    const score = scoreCandidate({
      requestedTitle: "Blinding Lights",
      requestedAlbum: "After Hours",
      resultName: "Blinding Lights (Special)",
      resultAlbumName: "After Hours (Deluxe)",
    });
    expect(score).toBe(10 + 7 + 10);
  });

  it("penalizes unrelated names and unexpected editions", () => {
    expect(
      scoreCandidate({
        requestedTitle: "Blinding Lights",
        resultName: "Some Other Song (Deluxe)",
      }),
    ).toBe(10 - 10 - 3);
  });
});

describe("extractMotionVideoUrls", () => {
  it("prefers the square asset and falls back across url keys", () => {
    expect(
      extractMotionVideoUrls({
        motionDetailSquare: { video: "https://x/square.m3u8" },
        motionDetailTall: { video: "https://x/tall.m3u8" },
      }),
    ).toEqual({ videoUrl: "https://x/square.m3u8", tallVideoUrl: "https://x/tall.m3u8" });

    expect(
      extractMotionVideoUrls({
        motionDetailRaw: { hlsUrl: "https://x/raw.m3u8" },
        motionDetailSquare: {},
      }),
    ).toEqual({ videoUrl: "https://x/raw.m3u8", tallVideoUrl: "https://x/raw.m3u8" });

    expect(extractMotionVideoUrls(undefined)).toEqual({ videoUrl: null, tallVideoUrl: null });
  });
});

describe("MotionArtworkManager", () => {
  const input = {
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours (Deluxe)",
    storefront: "us",
  };

  it("resolves a canvas end-to-end via search, song lookup and album lookup", async () => {
    const calls: string[] = [];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(happyRoutes, calls) });

    const result = await manager.get(input);
    expect(result).toEqual({
      videoUrl: ALBUM_CANVAS_URL,
      tallVideoUrl: ALBUM_TALL_URL,
      albumName: "After Hours (Deluxe)",
    });

    const fetchCount = calls.length;
    await manager.get(input);
    expect(calls.length).toBe(fetchCount);
  });

  it("resolves from the song attributes when the song itself carries the canvas", async () => {
    const routes: FakeRoute[] = [
      { urlIncludes: "/us/browse", body: BROWSE_HTML },
      { urlIncludes: "/assets/index~abc123.js", body: SCRIPT_BODY },
      { urlIncludes: "/catalog/us/search", body: SEARCH_BODY },
      {
        urlIncludes: `/catalog/us/songs/${SONG_ID}`,
        body: JSON.stringify({
          data: [
            {
              id: SONG_ID,
              attributes: {
                name: "Blinding Lights",
                artistName: "The Weeknd",
                editorialVideo: { motionDetailSquare: { video: "https://x/song.m3u8" } },
              },
              relationships: { albums: { data: [{ id: ALBUM_ID }] } },
            },
          ],
        }),
      },
      { urlIncludes: `/catalog/us/albums/${ALBUM_ID}`, body: ALBUM_BODY },
    ];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(routes) });
    const result = await manager.get(input);
    expect(result?.videoUrl).toBe("https://x/song.m3u8");
  });

  it("returns null when nothing scores high enough", async () => {
    const routes: FakeRoute[] = [
      { urlIncludes: "/us/browse", body: BROWSE_HTML },
      { urlIncludes: "/assets/index~abc123.js", body: SCRIPT_BODY },
      {
        urlIncludes: "/catalog/us/search",
        body: JSON.stringify({
          results: {
            songs: {
              data: [
                {
                  id: SONG_ID,
                  attributes: { name: "Completely Different", artistName: "The Weeknd" },
                },
              ],
            },
          },
        }),
      },
    ];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(routes) });
    await expect(manager.get(input)).resolves.toBeNull();
  });

  it("returns null when the album has no editorial video", async () => {
    const routes: FakeRoute[] = [
      { urlIncludes: "/us/browse", body: BROWSE_HTML },
      { urlIncludes: "/assets/index~abc123.js", body: SCRIPT_BODY },
      { urlIncludes: "/catalog/us/search", body: SEARCH_BODY },
      { urlIncludes: `/catalog/us/songs/${SONG_ID}`, body: SONG_LOOKUP_BODY },
      {
        urlIncludes: `/catalog/us/albums/${ALBUM_ID}`,
        body: JSON.stringify({
          data: [{ id: ALBUM_ID, attributes: { name: "After Hours (Deluxe)", artistName: "The Weeknd" } }],
        }),
      },
    ];
    const calls: string[] = [];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(routes, calls) });

    await expect(manager.get(input)).resolves.toBeNull();
    await expect(manager.get(input)).resolves.toBeNull();
    expect(calls.length).toBeGreaterThan(5);
  });

  it("fails fast when no valid token is available", async () => {
    const calls: string[] = [];
    const routes: FakeRoute[] = [
      { urlIncludes: "/us/browse", status: 403, body: "denied" },
    ];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(routes, calls) });
    await expect(manager.get(input)).resolves.toBeNull();
    // only the browse attempt: the expired hardcoded fallback must not be sent
    expect(calls).toHaveLength(1);
  });

  it("accepts a canvas when the album field mirrors the song title", async () => {
    // Real Liner data: singles and radio entries fill track.album with the
    // track title, so the request must downgrade to title + artist matching.
    const routes: FakeRoute[] = [
      { urlIncludes: "/us/browse", body: BROWSE_HTML },
      { urlIncludes: "/assets/index~abc123.js", body: SCRIPT_BODY },
      { urlIncludes: "/catalog/us/search", body: SEARCH_BODY },
      { urlIncludes: `/catalog/us/songs/${SONG_ID}`, body: SONG_LOOKUP_BODY },
      {
        urlIncludes: `/catalog/us/albums/${ALBUM_ID}`,
        body: JSON.stringify({
          data: [
            {
              id: ALBUM_ID,
              attributes: {
                name: "After Hours (Deluxe)",
                artistName: "The Weeknd",
                editorialVideo: { motionDetailSquare: { video: ALBUM_CANVAS_URL } },
              },
            },
          ],
        }),
      },
    ];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(routes) });
    await expect(
      manager.get({ title: "Blinding Lights", artist: "The Weeknd", album: "Blinding Lights", storefront: "us" }),
    ).resolves.toMatchObject({ videoUrl: ALBUM_CANVAS_URL });
  });

  it("rejects a canvas whose album differs from the requested one", async () => {
    const routes: FakeRoute[] = [
      { urlIncludes: "/us/browse", body: BROWSE_HTML },
      { urlIncludes: "/assets/index~abc123.js", body: SCRIPT_BODY },
      { urlIncludes: "/catalog/us/search", body: SEARCH_BODY },
      { urlIncludes: `/catalog/us/songs/${SONG_ID}`, body: SONG_LOOKUP_BODY },
      {
        urlIncludes: `/catalog/us/albums/${ALBUM_ID}`,
        body: JSON.stringify({
          data: [
            {
              id: ALBUM_ID,
              attributes: {
                name: "Completely Different Album",
                artistName: "The Weeknd",
                editorialVideo: { motionDetailSquare: { video: ALBUM_CANVAS_URL } },
              },
            },
          ],
        }),
      },
    ];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(routes) });
    await expect(manager.get(input)).resolves.toBeNull();
  });

  it("rejects blacklisted album names", async () => {
    const routes: FakeRoute[] = [
      { urlIncludes: "/us/browse", body: BROWSE_HTML },
      { urlIncludes: "/assets/index~abc123.js", body: SCRIPT_BODY },
      { urlIncludes: "/catalog/us/search", body: SEARCH_BODY },
      { urlIncludes: `/catalog/us/songs/${SONG_ID}`, body: SONG_LOOKUP_BODY },
      {
        urlIncludes: `/catalog/us/albums/${ALBUM_ID}`,
        body: JSON.stringify({
          data: [
            {
              id: ALBUM_ID,
              attributes: {
                name: "Apple Music Essentials",
                artistName: "The Weeknd",
                editorialVideo: { motionDetailSquare: { video: ALBUM_CANVAS_URL } },
              },
            },
          ],
        }),
      },
    ];
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(routes) });
    await expect(manager.get(input)).resolves.toBeNull();
  });

  it("exposes the handler through ipcMain and drops malformed payloads", async () => {
    const manager = new MotionArtworkManager({ fetchImpl: fakeFetchImpl(happyRoutes) });
    manager.register();

    const handler = mocks.handlers.get("motion-artwork:get");
    expect(handler).toBeDefined();

    await expect(handler?.({}, {})).resolves.toBeNull();
    await expect(handler?.({}, { title: "", artist: "x" })).resolves.toBeNull();
    // invalid storefront falls back to "us" and still resolves
    const withBadStorefront = await handler?.({}, { ...input, storefront: "PORTUGAL" });
    expect(withBadStorefront).toEqual({
      videoUrl: ALBUM_CANVAS_URL,
      tallVideoUrl: ALBUM_TALL_URL,
      albumName: "After Hours (Deluxe)",
    });
    await expect(handler?.({}, input)).resolves.toEqual({
      videoUrl: ALBUM_CANVAS_URL,
      tallVideoUrl: ALBUM_TALL_URL,
      albumName: "After Hours (Deluxe)",
    });
  });
});

afterEach(() => {
  mocks.handlers.clear();
  vi.restoreAllMocks();
});
