import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSoundCloudApi } from "@/shared/media/soundcloud";
import { log } from "@/shared/utils/logger";
import { createSoundCloudCollection } from "./soundcloudCollection";
import { collectSoundCloudLikes, MAX_LIKES_PAGES } from "./soundcloudLikes";

vi.mock("@/shared/media/soundcloud", () => ({
  SOUNDCLOUD_API: "https://api-v2.soundcloud.com",
  fetchSoundCloudApi: vi.fn(),
}));

vi.mock("@/shared/utils/logger", () => ({ log: vi.fn() }));

const fetchMock = vi.mocked(fetchSoundCloudApi);
const logMock = vi.mocked(log);

function page(offset: number, next: boolean): Response {
  return new Response(
    JSON.stringify({
      collection: [{ track: { id: offset, title: `Song ${offset}` } }],
      next_href: next
        ? `https://api-v2.soundcloud.com/users/7/likes?offset=${offset + 1}&limit=50`
        : null,
    }),
  );
}

function offsetOf(pathOrUrl: string): number {
  return Number(
    new URL(pathOrUrl, "https://api-v2.soundcloud.com").searchParams.get(
      "offset",
    ) ?? 0,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  logMock.mockReset();
});

describe("collectSoundCloudLikes", () => {
  it("stops at the page limit when the API keeps sending new pages", async () => {
    fetchMock.mockImplementation(async (pathOrUrl) =>
      page(offsetOf(pathOrUrl), true),
    );
    const collection = createSoundCloudCollection();

    await collectSoundCloudLikes({ id: 7 }, "listener", collection);

    expect(fetchMock).toHaveBeenCalledTimes(MAX_LIKES_PAGES);
    expect(collection.rawTracks).toHaveLength(MAX_LIKES_PAGES);
    expect(logMock).toHaveBeenCalledWith(
      "yellow",
      "import",
      expect.stringContaining(`stopped at ${MAX_LIKES_PAGES} pages`),
    );
  });

  it("keeps fetched tracks and logs when a later page fails", async () => {
    fetchMock.mockImplementation(async (pathOrUrl) => {
      const offset = offsetOf(pathOrUrl);
      return offset === 2
        ? new Response("", { status: 500 })
        : page(offset, true);
    });
    const collection = createSoundCloudCollection();

    await collectSoundCloudLikes({ id: 7 }, "listener", collection);

    expect(collection.rawTracks).toHaveLength(2);
    expect(logMock).toHaveBeenCalledWith(
      "yellow",
      "import",
      "soundcloud likes import is partial: page 3 failed with 500, kept 2 tracks",
    );
  });

  it("does not log when every page loads", async () => {
    fetchMock.mockImplementation(async (pathOrUrl) => {
      const offset = offsetOf(pathOrUrl);
      return page(offset, offset < 3);
    });
    const collection = createSoundCloudCollection();

    await collectSoundCloudLikes({ id: 7 }, "listener", collection);

    expect(collection.rawTracks).toHaveLength(4);
    expect(logMock).not.toHaveBeenCalled();
  });
});
