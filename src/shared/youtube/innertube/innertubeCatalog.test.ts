import { afterEach, describe, expect, it, vi } from "vitest";

const { resetClientVisitorData } = vi.hoisted(() => ({
  resetClientVisitorData: vi.fn(),
}));

vi.mock("../session/visitorSession", () => ({
  getClientVisitorData: async () => "CgtVISITOR123",
  resetClientVisitorData,
}));

import { innertubeCatalog } from "./innertubeCatalog";

const artistLink = (browseId: string) => ({
  browseEndpoint: {
    browseId,
    browseEndpointContextSupportedConfigs: {
      browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" },
    },
  },
});

function panelItem(videoId: string, title: string, selected = false) {
  return {
    playlistPanelVideoRenderer: {
      videoId,
      selected,
      title: { runs: [{ text: title }] },
      longBylineText: {
        runs: [
          { text: "The Weeknd", navigationEndpoint: artistLink("UCweeknd") },
          { text: " • " },
          { text: "2020" },
        ],
      },
      lengthText: { runs: [{ text: "3:20" }] },
    },
  };
}

function nextResponse(items: unknown[]) {
  return {
    contents: {
      singleColumnMusicWatchNextResultsRenderer: {
        tabbedRenderer: {
          watchNextTabbedResultsRenderer: {
            tabs: [
              {
                tabRenderer: {
                  content: {
                    musicQueueRenderer: {
                      content: { playlistPanelRenderer: { contents: items } },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
  };
}

function songRow(videoId: string, title: string) {
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
            text: {
              runs: [
                {
                  text: "The Weeknd",
                  navigationEndpoint: artistLink("UCweeknd"),
                },
                { text: "3:20" },
              ],
            },
          },
        },
      ],
    },
  };
}

function searchResponse(rows: unknown[]) {
  return {
    contents: {
      tabbedSearchResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              content: {
                sectionListRenderer: {
                  contents: [{ musicShelfRenderer: { contents: rows } }],
                },
              },
            },
          },
        ],
      },
    },
  };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  const init = call[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("innertubeCatalog", () => {
  it("builds radio from the RDAMVM queue and honours k", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        json(
          nextResponse([
            panelItem("aaaaaaaaaaa", "One"),
            panelItem("bbbbbbbbbbb", "Two"),
            panelItem("ccccccccccc", "Three"),
          ]),
        ),
      );
    const radio = await innertubeCatalog.getRadio("aaaaaaaaaaa", { k: 2 });

    expect(radio.items.map((item) => item.title)).toEqual(["One", "Two"]);
    expect(radio.items[0]).toMatchObject({
      artists: [{ id: "UCweeknd", name: "The Weeknd" }],
      durationMs: 200_000,
    });
    expect(bodyOf(fetchSpy.mock.calls[0])).toMatchObject({
      videoId: "aaaaaaaaaaa",
      playlistId: "RDAMVMaaaaaaaaaaa",
    });
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
    );
  });

  it("resolves track details from the selected queue row", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(
        nextResponse([
          panelItem("xxxxxxxxxxx", "Other"),
          panelItem("aaaaaaaaaaa", "Blinding Lights", true),
        ]),
      ),
    );
    const track = await innertubeCatalog.getTrack("aaaaaaaaaaa");
    expect(track).toMatchObject({
      id: "aaaaaaaaaaa",
      title: "Blinding Lights",
      releaseDate: "2020",
    });
  });

  it("ranks studio tracks that match the query first for track search", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const params = (JSON.parse(String(init?.body)) as { params?: string })
        .params;
      if (params?.startsWith("EgWKAQIIA")) {
        return json(
          searchResponse([
            songRow("unrelated01", "Save Your Tears"),
            songRow("blinding001", "Blinding Lights"),
          ]),
        );
      }
      return json(searchResponse([]));
    });
    const results = await innertubeCatalog.search(
      "weeknd blinding lights",
      "track",
    );
    expect(results.map((item) => item.id)).toEqual([
      "blinding001",
      "unrelated01",
    ]);
  });

  it("throws when every search request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("blocked", { status: 429 }),
    );
    await expect(innertubeCatalog.search("anything", "all")).rejects.toThrow(
      /HTTP 429/,
    );
  });

  it("prefixes bare playlist ids with VL when browsing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        header: {
          musicResponsiveHeaderRenderer: {
            title: { runs: [{ text: "Mix" }] },
          },
        },
        contents: { rows: [songRow("aaaaaaaaaaa", "One")] },
      }),
    );
    const playlist = await innertubeCatalog.getPlaylist("PLabc");
    expect(bodyOf(fetchSpy.mock.calls[0]).browseId).toBe("VLPLabc");
    expect(playlist).toMatchObject({
      id: "PLabc",
      title: "Mix",
      tracks: [{ id: "aaaaaaaaaaa" }],
    });
  });
});
