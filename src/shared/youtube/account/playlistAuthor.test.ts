import { describe, expect, it } from "vitest";
import { parsePlaylistAuthor } from "./playlistAuthor";

const byline = (...texts: string[]) => ({
  bylines: [
    {
      lineRenderer: {
        items: texts.map((text) => ({
          lineItemRenderer: { text: { simpleText: text } },
        })),
      },
    },
  ],
});

describe("parsePlaylistAuthor", () => {
  it("skips the playlist label and the song count", () => {
    expect(
      parsePlaylistAuthor(
        byline("Auto playlist", "•", "whiteheartemoji", "•", "23 songs"),
      ),
    ).toBe("whiteheartemoji");
  });

  it("skips counts and years on album bylines", () => {
    expect(
      parsePlaylistAuthor(byline("17 SEVENTEEN", "•", "2 songs", "•", "2026")),
    ).toBe("17 SEVENTEEN");
  });

  it("returns nothing when only labels are present", () => {
    expect(parsePlaylistAuthor(byline("Playlist", "•", "5 songs"))).toBe(
      undefined,
    );
  });
});
