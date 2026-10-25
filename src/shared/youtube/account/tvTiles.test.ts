import { describe, expect, it } from "vitest";
import { lineBrowseId, lineText, parseTvTiles } from "./tvTiles";

const line = (text: Record<string, unknown>) => ({
  lineRenderer: { items: [{ lineItemRenderer: { text } }] },
});

const squareArt = "https://yt3.googleusercontent.com/art=w226-h226-l90-rj";

const body = {
  contents: {
    gridRenderer: {
      items: [
        {
          tileRenderer: {
            contentId: "1xYeWxVxIDs",
            contentType: "TILE_CONTENT_TYPE_PLAYLIST",
            onSelectCommand: { browseEndpoint: { browseId: "VLLM" } },
            header: {
              tileHeaderRenderer: {
                thumbnail: {
                  thumbnails: [{ url: squareArt, width: 226, height: 226 }],
                },
              },
            },
            metadata: {
              tileMetadataRenderer: {
                title: { runs: [{ text: "Liked Music" }] },
                lines: [line({ simpleText: "Auto playlist • 5 songs" })],
              },
            },
          },
        },
        {
          tileRenderer: {
            contentId: "P5hasfXdq0c",
            contentType: "TILE_CONTENT_TYPE_VIDEO",
            header: {
              tileHeaderRenderer: {
                thumbnailOverlays: [
                  {
                    thumbnailOverlayTimeStatusRenderer: {
                      text: { simpleText: "2:31" },
                    },
                  },
                ],
              },
            },
            metadata: {
              tileMetadataRenderer: {
                title: { simpleText: "chrome hearts" },
                lines: [
                  line({
                    runs: [
                      {
                        text: "kai angel",
                        navigationEndpoint: {
                          browseEndpoint: {
                            browseId: "UC0CiS13gPRytHV77E7SWYrg",
                          },
                        },
                      },
                    ],
                  }),
                ],
              },
            },
          },
        },
        {
          tileRenderer: {
            contentId: "qf7dgFr0PEs",
            contentType: "TILE_CONTENT_TYPE_VIDEO",
            header: {
              trackTileHeaderRenderer: {
                title: { simpleText: "01" },
                duration: { simpleText: "1:04" },
                thumbnail: {
                  thumbnails: [{ url: squareArt, width: 226, height: 226 }],
                },
              },
            },
            onLongPressCommand: {
              showMenuCommand: { subtitle: { simpleText: "17 SEVENTEEN" } },
            },
          },
        },
      ],
    },
  },
};

describe("parseTvTiles", () => {
  it("takes the playlist id from the browse endpoint", () => {
    const [playlist] = parseTvTiles(body, "playlist");
    expect(playlist).toMatchObject({ id: "LM", title: "Liked Music" });
    expect(playlist.cover?.url).toContain("yt3.googleusercontent.com/art");
    expect(lineText(playlist, 0)).toBe("Auto playlist • 5 songs");
  });

  it("maps video tiles with duration and channel link", () => {
    const videos = parseTvTiles(body, "video");
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({ id: "P5hasfXdq0c", overlayText: "2:31" });
    expect(lineText(videos[0], 0)).toBe("kai angel");
    expect(lineBrowseId(videos[0], 0)).toBe("UC0CiS13gPRytHV77E7SWYrg");
  });

  it("maps album track tiles from the track header", () => {
    const track = parseTvTiles(body, "video")[1];
    expect(track).toMatchObject({
      id: "qf7dgFr0PEs",
      title: "01",
      overlayText: "1:04",
    });
    expect(lineText(track, 0)).toBe("17 SEVENTEEN");
  });
});
