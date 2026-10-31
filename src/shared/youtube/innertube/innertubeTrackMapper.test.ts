import { describe, expect, it } from "vitest";
import {
  fallbackArtistsFromRuns,
  mapInnertubeTrack,
} from "./innertubeTrackMapper";

const dot = { text: " • " };

function artistRun(name: string, browseId: string) {
  return {
    text: name,
    navigationEndpoint: {
      browseEndpoint: {
        browseId,
        browseEndpointContextSupportedConfigs: {
          browseEndpointContextMusicConfig: {
            pageType: "MUSIC_PAGE_TYPE_ARTIST",
          },
        },
      },
    },
  };
}

describe("fallbackArtistsFromRuns", () => {
  it("skips the result type label and uses the artist that follows it", () => {
    const runs = [
      { text: "Song" },
      dot,
      { text: "ROLDOZZZER" },
      dot,
      { text: "100 лет" },
      dot,
      { text: "2:43" },
    ];
    expect(fallbackArtistsFromRuns(runs)).toEqual([
      { id: null, name: "ROLDOZZZER" },
    ]);
  });

  it("splits several unlinked artists", () => {
    const runs = [
      { text: "Song" },
      dot,
      { text: "VILLIAN, madk1d & Aarne" },
      dot,
      { text: "2:07" },
    ];
    expect(fallbackArtistsFromRuns(runs).map((a) => a.name)).toEqual([
      "VILLIAN",
      "madk1d",
      "Aarne",
    ]);
  });

  it("keeps the real id of a linked artist next to an unlinked one", () => {
    const runs = [
      { text: "Song" },
      dot,
      artistRun("VILLIAN", "UC123"),
      { text: " & " },
      { text: "Aarne" },
      dot,
      { text: "2:07" },
    ];
    expect(fallbackArtistsFromRuns(runs)).toEqual([
      { id: "UC123", name: "VILLIAN" },
      { id: null, name: "Aarne" },
    ]);
  });

  it("reads a plain artist column without a label", () => {
    expect(fallbackArtistsFromRuns([{ text: "2hollis" }])).toEqual([
      { id: null, name: "2hollis" },
    ]);
  });

  it("never turns a duration or a lone label into an artist", () => {
    expect(
      fallbackArtistsFromRuns([{ text: "Song" }, dot, { text: "2:43" }])[0]!
        .name,
    ).toBe("Unknown Artist");
  });
});

describe("mapInnertubeTrack", () => {
  it("does not show the Song label as the artist of a search row", () => {
    const row = {
      musicResponsiveListItemRenderer: {
        flexColumns: [
          {
            musicResponsiveListItemFlexColumnRenderer: {
              text: {
                runs: [
                  {
                    text: "YOU",
                    navigationEndpoint: {
                      watchEndpoint: { videoId: "abc123" },
                    },
                  },
                ],
              },
            },
          },
          {
            musicResponsiveListItemFlexColumnRenderer: {
              text: {
                runs: [
                  { text: "Song" },
                  dot,
                  { text: "ROLDOZZZER" },
                  dot,
                  { text: "1:33" },
                ],
              },
            },
          },
        ],
      },
    };
    const track = mapInnertubeTrack(row);
    expect(track?.artists).toEqual([{ id: null, name: "ROLDOZZZER" }]);
    expect(track?.durationMs).toBe(93_000);
  });
});
