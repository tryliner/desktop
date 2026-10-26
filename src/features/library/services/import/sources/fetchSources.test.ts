import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postInnertube = vi.hoisted(() =>
  vi.fn<
    (endpoint: string, body: Record<string, unknown>) => Promise<unknown>
  >(),
);

vi.mock("@/shared/youtube/innertube/innertubeClient", () => ({
  postInnertube,
}));

import { parseImportSource } from "../parseImportSource";
import {
  rememberSoundCloudClientId,
  resetSoundCloudClientIdCache,
} from "@/shared/media/soundcloud";

type Route = (url: string) => unknown;

function mockFetch(route: Route) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = route(url);
    if (body === undefined) return new Response("not found", { status: 404 });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function deezerTrack(id: number) {
  return {
    id,
    title: `T${id}`,
    artist: { name: "A" },
    album: { title: "Al", cover_big: "c" },
    duration: 10,
  };
}

function ytRow(videoId: string, title: string) {
  return {
    musicResponsiveListItemRenderer: {
      playlistItemData: { videoId },
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: title }] },
          },
        },
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: "Artist" }] },
          },
        },
      ],
    },
  };
}

beforeEach(() => {
  postInnertube.mockReset();
  resetSoundCloudClientIdCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseImportSource with mocked network", () => {
  it("imports deezer playlists with pagination", async () => {
    mockFetch((url) => {
      if (url === "https://api.deezer.com/playlist/42") {
        return {
          title: "Deezer PL",
          nb_tracks: 3,
          tracks: {
            data: [deezerTrack(1)],
            next: "https://api.deezer.com/next",
          },
        };
      }
      if (url === "https://api.deezer.com/next")
        return { data: [deezerTrack(2)] };
      if (url.startsWith("https://api.deezer.com/playlist/42/tracks"))
        return { data: [deezerTrack(3)] };
      return undefined;
    });
    const playlist = await parseImportSource("deezer.com/en/playlist/42");
    expect(playlist.source).toBe("deezer");
    expect(playlist.title).toBe("Deezer PL");
    expect(playlist.tracks.map((track) => track.sourceId)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(playlist.tracks[0]).toMatchObject({
      durationMs: 10_000,
      coverUrl: "c",
      album: "Al",
    });
    expect(playlist.canonicalTrackIds).toBeUndefined();
  });

  it("imports youtube playlists through innertube with continuation", async () => {
    postInnertube.mockImplementation(async (_endpoint, body) => {
      if (body.browseId === "VLPLx") {
        return {
          header: {
            musicResponsiveHeaderRenderer: {
              title: { runs: [{ text: "YT PL" }] },
            },
          },
          contents: [ytRow("aaaaaaaaaaa", "One")],
          continuations: [{ nextContinuationData: { continuation: "tok" } }],
        };
      }
      if (body.continuation === "tok")
        return { items: [ytRow("bbbbbbbbbbb", "Two")] };
      return {};
    });
    const playlist = await parseImportSource(
      "https://music.youtube.com/playlist?list=PLx",
    );
    expect(playlist.title).toBe("YT PL");
    expect(playlist.tracks.map((track) => track.title)).toEqual(["One", "Two"]);
    expect(playlist.canonicalTrackIds).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb"]);
    expect(postInnertube).toHaveBeenCalledWith(
      "browse",
      { continuation: "tok" },
      expect.anything(),
    );
  });

  it("imports soundcloud playlists from html hydration", async () => {
    rememberSoundCloudClientId("test-client-id-0000000000000000");
    const hydration = [
      {
        hydratable: "playlist",
        data: {
          title: "SC PL",
          tracks: [
            {
              id: 11,
              title: "Song",
              duration: 5000,
              user: { id: 3, username: "uploader" },
            },
            { id: 12 },
          ],
        },
      },
    ];
    mockFetch((url) => {
      if (url === "https://soundcloud.com/user/sets/pl") {
        return `<script>window.__sc_hydration = ${JSON.stringify(hydration)};</script>`;
      }
      if (url.startsWith("https://api-v2.soundcloud.com/tracks")) {
        return [
          {
            id: 12,
            title: "Stub Song",
            duration: 6000,
            user: { id: 4, username: "other" },
          },
        ];
      }
      return undefined;
    });
    const playlist = await parseImportSource(
      "https://soundcloud.com/user/sets/pl?si=1",
    );
    expect(playlist.title).toBe("SC PL");
    expect(playlist.tracks.map((track) => track.title)).toEqual([
      "Song",
      "Stub Song",
    ]);
    expect(playlist.canonicalTrackIds).toEqual(["sc:11", "sc:12"]);
  });

  it("rejects unsupported hosts", async () => {
    await expect(parseImportSource("https://example.com/x")).rejects.toThrow(
      "Unsupported import host",
    );
  });

  it("honours an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      parseImportSource("https://www.deezer.com/playlist/1", controller.signal),
    ).rejects.toBeDefined();
  });
});
