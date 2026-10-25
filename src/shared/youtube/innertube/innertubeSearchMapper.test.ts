import { describe, expect, it } from "vitest";
import {
  mapInnertubeSearchResult,
  mapSearchResponse,
} from "./innertubeSearchMapper";
import { isJunkVideo, matchesQueryWell } from "./innertubeSearchRanking";

const artistEndpoint = (
  browseId: string,
  pageType = "MUSIC_PAGE_TYPE_ARTIST",
) => ({
  browseEndpoint: {
    browseId,
    browseEndpointContextSupportedConfigs: {
      browseEndpointContextMusicConfig: { pageType },
    },
  },
});

const songRow = {
  musicResponsiveListItemRenderer: {
    playlistItemData: { videoId: "4NRXx6U8ABQ" },
    flexColumns: [
      {
        musicResponsiveListItemFlexColumnRenderer: {
          text: { runs: [{ text: "Blinding Lights" }] },
        },
      },
      {
        musicResponsiveListItemFlexColumnRenderer: {
          text: {
            runs: [
              {
                text: "The Weeknd",
                navigationEndpoint: artistEndpoint("UClYV6hHlupm_S_ObS1W-DYw"),
              },
              { text: " • " },
              {
                text: "After Hours",
                navigationEndpoint: artistEndpoint(
                  "MPREb_x",
                  "MUSIC_PAGE_TYPE_ALBUM",
                ),
              },
              { text: " • " },
              { text: "3:21" },
            ],
          },
        },
      },
    ],
    thumbnail: {
      musicThumbnailRenderer: {
        thumbnail: {
          thumbnails: [
            {
              url: "https://lh3.googleusercontent.com/abc=w60-h60-l90-rj",
              width: 60,
              height: 60,
            },
          ],
        },
      },
    },
  },
};

describe("innertube search mapper", () => {
  it("maps a music card shelf track with linked artist and duration", () => {
    const result = mapInnertubeSearchResult({
      musicCardShelfRenderer: {
        title: { runs: [{ text: "Smells Like Teen Spirit" }] },
        subtitle: {
          runs: [
            { text: "Video" },
            { text: " • " },
            {
              text: "Nirvana",
              navigationEndpoint: artistEndpoint("UCrPe3hLA51968GwxHSZ1llw"),
            },
            { text: " • " },
            { text: "4:39" },
          ],
        },
        onTap: { watchEndpoint: { videoId: "hTWKbfoikeg" } },
      },
    });
    expect(result).toMatchObject({
      type: "track",
      id: "hTWKbfoikeg",
      artists: [{ id: "UCrPe3hLA51968GwxHSZ1llw", name: "Nirvana" }],
      durationMs: 279_000,
      explicit: false,
    });
  });

  it("falls back to the plain subtitle artist when the card has no artist link", () => {
    const result = mapInnertubeSearchResult({
      musicCardShelfRenderer: {
        title: { runs: [{ text: "In the End" }] },
        subtitle: {
          runs: [
            { text: "Video" },
            { text: " • " },
            { text: "Linkin Park" },
            { text: " • " },
            { text: "3:39" },
          ],
        },
        thumbnailOverlay: {
          musicItemThumbnailOverlayRenderer: {
            content: {
              musicPlayButtonRenderer: {
                playNavigationEndpoint: {
                  watchEndpoint: { videoId: "eVTXPUF4Oz4" },
                },
              },
            },
          },
        },
      },
    });
    expect(result).toMatchObject({
      id: "eVTXPUF4Oz4",
      artists: [{ id: "unknown", name: "Linkin Park" }],
      durationMs: 219_000,
    });
  });

  it("maps a song row with artist, album, duration and a 512px square cover", () => {
    expect(mapInnertubeSearchResult(songRow)).toEqual({
      type: "track",
      id: "4NRXx6U8ABQ",
      title: "Blinding Lights",
      artists: [{ id: "UClYV6hHlupm_S_ObS1W-DYw", name: "The Weeknd" }],
      album: { id: "MPREb_x", title: "After Hours" },
      durationMs: 201_000,
      cover: {
        url: "https://lh3.googleusercontent.com/abc=w512-h512-l90-rj",
        width: 512,
        height: 512,
      },
      explicit: false,
    });
  });

  it("maps an artist row from a browse endpoint", () => {
    const result = mapInnertubeSearchResult({
      musicResponsiveListItemRenderer: {
        navigationEndpoint: artistEndpoint("UClYV6hHlupm_S_ObS1W-DYw"),
        flexColumns: [
          {
            musicResponsiveListItemFlexColumnRenderer: {
              text: { runs: [{ text: "The Weeknd" }] },
            },
          },
        ],
      },
    });
    expect(result).toEqual({
      type: "artist",
      id: "UClYV6hHlupm_S_ObS1W-DYw",
      name: "The Weeknd",
    });
  });

  it("reads shelves out of a full search response and dedupes", () => {
    const response = {
      contents: {
        tabbedSearchResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      { musicShelfRenderer: { contents: [songRow, songRow] } },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };
    expect(mapSearchResponse(response).map((item) => item.id)).toEqual([
      "4NRXx6U8ABQ",
    ]);
  });
});

describe("search ranking", () => {
  it("filters reaction and slowed uploads unless the query asks for them", () => {
    expect(isJunkVideo("Blinding Lights REACTION", "blinding lights")).toBe(
      true,
    );
    expect(
      isJunkVideo("Blinding Lights (slowed + reverb)", "blinding lights"),
    ).toBe(true);
    expect(
      isJunkVideo(
        "Blinding Lights (slowed + reverb)",
        "blinding lights slowed",
      ),
    ).toBe(false);
  });

  it("requires most query tokens to appear in the title or artists", () => {
    expect(
      matchesQueryWell("the weeknd blinding lights", "Blinding Lights", [
        "The Weeknd",
      ]),
    ).toBe(true);
    expect(
      matchesQueryWell("the weeknd blinding lights", "Save Your Tears", [
        "The Weeknd",
      ]),
    ).toBe(false);
  });
});
