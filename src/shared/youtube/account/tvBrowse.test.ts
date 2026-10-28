import { beforeEach, describe, expect, it, vi } from "vitest";
import { postInnertube } from "../innertube/innertubeClient";
import { log } from "@/shared/utils/logger";
import { browseTvTiles } from "./tvBrowse";

vi.mock("../innertube/innertubeClient", () => ({ postInnertube: vi.fn() }));
vi.mock("@/shared/utils/logger", () => ({ log: vi.fn() }));

const postMock = vi.mocked(postInnertube);
const logMock = vi.mocked(log);
const PAGE_SIZE = 15;

function tile(index: number) {
  return {
    tileRenderer: {
      contentType: "TILE_CONTENT_TYPE_VIDEO",
      contentId: `video${index}`,
      metadata: {
        tileMetadataRenderer: { title: { simpleText: `Song ${index}` } },
      },
    },
  };
}

function servePlaylist(total: number) {
  postMock.mockImplementation(async (_endpoint, body) => {
    const start = Number(body.continuation ?? 0);
    const end = Math.min(start + PAGE_SIZE, total);
    return {
      contents: Array.from({ length: end - start }, (_, i) => tile(start + i)),
      ...(end < total
        ? {
            continuations: [
              { nextContinuationData: { continuation: `${end}` } },
            ],
          }
        : {}),
    };
  });
}

beforeEach(() => {
  postMock.mockReset();
  logMock.mockReset();
});

describe("browseTvTiles", () => {
  it("loads every page of a playlist longer than fifty pages", async () => {
    servePlaylist(1677);

    const { tiles } = await browseTvTiles("VLLM", "video", 500);

    expect(tiles).toHaveLength(1677);
    expect(tiles.at(-1)?.id).toBe("video1676");
    expect(postMock).toHaveBeenCalledTimes(112);
    expect(logMock).not.toHaveBeenCalled();
  });

  it("parses every page it fetches and logs when it hits the limit", async () => {
    servePlaylist(1677);

    const { tiles } = await browseTvTiles("VLLM", "video", 50);

    expect(postMock).toHaveBeenCalledTimes(50);
    expect(tiles).toHaveLength(750);
    expect(logMock).toHaveBeenCalledWith(
      "yellow",
      "youtube",
      "tv browse VLLM stopped at 50 pages with 750 items",
    );
  });

  it("stops when a page brings no new items", async () => {
    postMock.mockResolvedValue({
      contents: [tile(0)],
      continuations: [{ nextContinuationData: { continuation: "same" } }],
    });

    const { tiles } = await browseTvTiles("VLLM", "video", 500);

    expect(tiles).toHaveLength(1);
    expect(postMock).toHaveBeenCalledTimes(2);
  });
});
