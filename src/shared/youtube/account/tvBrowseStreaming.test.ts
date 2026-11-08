import { beforeEach, describe, expect, it, vi } from "vitest";
import { postInnertube } from "../innertube/innertubeClient";
import { browseTvTiles } from "./tvBrowse";

vi.mock("../innertube/innertubeClient", () => ({ postInnertube: vi.fn() }));
vi.mock("@/shared/utils/logger", () => ({ log: vi.fn() }));

const postMock = vi.mocked(postInnertube);
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
});

describe("browseTvTiles progress callback", () => {
  it("reports growing snapshots for every page with more behind it", async () => {
    servePlaylist(40);
    const sizes: number[] = [];

    const { tiles } = await browseTvTiles(
      "VLLM",
      "video",
      500,
      undefined,
      (snapshot) => sizes.push(snapshot.tiles.length),
    );

    expect(sizes).toEqual([15, 30]);
    expect(tiles).toHaveLength(40);
  });

  it("does not report a single-page playlist", async () => {
    servePlaylist(10);
    const onPage = vi.fn();

    const { tiles } = await browseTvTiles(
      "VLLM",
      "video",
      500,
      undefined,
      onPage,
    );

    expect(onPage).not.toHaveBeenCalled();
    expect(tiles).toHaveLength(10);
  });
});
