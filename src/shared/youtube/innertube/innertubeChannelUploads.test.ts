import { describe, expect, it } from "vitest";
import {
  channelIdOfArtist,
  mapChannelUploads,
} from "./innertubeChannelUploads";

const artist = { id: "UCN7668OKiM_Wkq5Uf2tPozw", name: "shadowraze best" };

function lockup(contentId: string, title: string, duration: string) {
  return {
    lockupViewModel: {
      contentId,
      contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
      contentImage: {
        thumbnailViewModel: {
          overlays: [
            {
              thumbnailBottomOverlayViewModel: {
                badges: [{ thumbnailBadgeViewModel: { text: duration } }],
              },
            },
          ],
        },
      },
      metadata: {
        lockupMetadataViewModel: { title: { content: title } },
      },
    },
  };
}

describe("channel uploads", () => {
  it("prefers the channel linked from the music artist header", () => {
    const body = {
      header: {
        musicImmersiveHeaderRenderer: {
          subscriptionButton: {
            subscribeButtonRenderer: { channelId: "UCr-EPKkR9kIDJL0yNkF90Ug" },
          },
        },
      },
    };
    expect(channelIdOfArtist(artist.id, body)).toBe("UCr-EPKkR9kIDJL0yNkF90Ug");
    expect(channelIdOfArtist(artist.id, {})).toBe(artist.id);
    expect(channelIdOfArtist("MPLAUCxyz", {})).toBeUndefined();
  });

  it("maps video lockups from the uploads playlist into tracks", () => {
    const body = {
      contents: [
        lockup("PhkYvRQBgzc", "ASTRAL STEP", "2:01"),
        lockup("PhkYvRQBgzc", "ASTRAL STEP", "2:01"),
        lockup("Abc123xyz00", "ASTRAL STEP (FULL)", "1:02:03"),
        {
          lockupViewModel: {
            contentId: "PLsomething",
            contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
            metadata: {
              lockupMetadataViewModel: { title: { content: "Mix" } },
            },
          },
        },
      ],
    };

    expect(mapChannelUploads(body, artist)).toEqual([
      {
        id: "PhkYvRQBgzc",
        title: "ASTRAL STEP",
        artists: [artist],
        durationMs: 121_000,
        cover: {
          url: "https://i.ytimg.com/vi/PhkYvRQBgzc/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
      {
        id: "Abc123xyz00",
        title: "ASTRAL STEP (FULL)",
        artists: [artist],
        durationMs: 3_723_000,
        cover: {
          url: "https://i.ytimg.com/vi/Abc123xyz00/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
    ]);
  });
});
