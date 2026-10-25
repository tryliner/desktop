import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@/shared/contracts";

const mocks = vi.hoisted(() => ({
  parseImportSource: vi.fn(),
  searchRaw: vi.fn(),
}));

vi.mock("../parseImportSource", () => ({
  parseImportSource: mocks.parseImportSource,
}));
vi.mock("@/shared/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/youtube")>();
  return { ...actual, searchRaw: mocks.searchRaw };
});

import { api, ApiError } from "@/shared/api";
import { runClientImport } from "./clientImportManager";
import { finalizeImportedPlaylist } from "./finalizeImport";

function searchTrack(
  id: string,
  title: string,
  artist: string,
  durationMs: number,
): SearchResult {
  return {
    type: "track",
    id,
    title,
    artists: [{ id: `UC_${artist}`, name: artist }],
    durationMs,
  };
}

const spotifyPlaylist = {
  source: "spotify" as const,
  sourceUrl: "https://open.spotify.com/playlist/abc",
  title: "Road trip",
  tracks: [
    {
      sourceId: "sp1",
      title: "Blinding Lights",
      artists: ["The Weeknd"],
      durationMs: 200_040,
    },
    {
      sourceId: "sp2",
      title: "Some Obscure Demo",
      artists: ["Nobody Known"],
      durationMs: 61_000,
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  mocks.parseImportSource.mockReset();
  mocks.searchRaw.mockReset();
});

describe("runClientImport", () => {
  it("auto-approves confident matches and leaves the rest out of the playlist", async () => {
    mocks.parseImportSource.mockResolvedValue(spotifyPlaylist);
    mocks.searchRaw.mockImplementation(async (query: string) =>
      query.toLowerCase().includes("blinding")
        ? [searchTrack("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200_000)]
        : [],
    );
    const progress: number[] = [];

    const outcome = await runClientImport(spotifyPlaylist.sourceUrl, {
      onProgress: (update) =>
        progress.push(update.result.imported + update.result.skipped),
    });

    expect(outcome.approvedTracks.map((track) => track.id)).toEqual([
      "4NRXx6U8ABQ",
    ]);
    expect(outcome.result).toEqual({ total: 2, imported: 1, skipped: 1 });
    expect(outcome.reviewItems).toEqual([]);
    expect(progress[progress.length - 1]).toBe(2);
  });

  it("sends ambiguous matches with a candidate to review", async () => {
    mocks.parseImportSource.mockResolvedValue({
      ...spotifyPlaylist,
      tracks: [spotifyPlaylist.tracks[0]],
    });
    mocks.searchRaw.mockResolvedValue([
      searchTrack(
        "liveversion",
        "Blinding Lights (Live at SNL)",
        "The Weeknd",
        260_000,
      ),
    ]);

    const outcome = await runClientImport(spotifyPlaylist.sourceUrl);

    expect(outcome.approvedTracks).toEqual([]);
    expect(outcome.reviewItems).toHaveLength(1);
    expect(outcome.reviewItems[0]).toMatchObject({
      status: "pending",
      proposedTrack: { id: "liveversion" },
      position: 0,
    });
  });

  it("uses youtube ids directly without searching", async () => {
    mocks.parseImportSource.mockResolvedValue({
      source: "youtube",
      sourceUrl: "https://music.youtube.com/playlist?list=PL1",
      title: "Mine",
      canonicalTrackIds: ["dQw4w9WgXcQ"],
      tracks: [
        {
          sourceId: "dQw4w9WgXcQ",
          title: "Never Gonna Give You Up",
          artists: ["Rick Astley"],
          durationMs: 213_000,
        },
      ],
    });

    const outcome = await runClientImport(
      "https://music.youtube.com/playlist?list=PL1",
    );

    expect(mocks.searchRaw).not.toHaveBeenCalled();
    expect(outcome.approvedTracks[0]).toMatchObject({
      id: "dQw4w9WgXcQ",
      cover: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
    });
  });
});

describe("finalizeImportedPlaylist", () => {
  const track = {
    id: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    artists: [{ id: "UC1", name: "Rick Astley" }],
    durationMs: 213_000,
  };
  const playlist = { id: "pl_1", title: "Mine", isPublic: false } as Awaited<
    ReturnType<typeof api.createPlaylist>
  >;

  it("saves all matched tracks in one bulk request, deduplicated", async () => {
    vi.spyOn(api, "createPlaylist").mockResolvedValue(playlist);
    const bulk = vi
      .spyOn(api, "addPlaylistTrackSnapshots")
      .mockResolvedValue({ items: [], added: 1, rejected: 0 });

    await expect(
      finalizeImportedPlaylist("Mine", undefined, [track, track]),
    ).resolves.toEqual({ playlistId: "pl_1", saved: 1 });
    expect(bulk).toHaveBeenCalledWith("pl_1", [track]);
  });

  it("falls back to per-track adds with snapshots when the bulk endpoint is missing", async () => {
    vi.spyOn(api, "createPlaylist").mockResolvedValue(playlist);
    vi.spyOn(api, "addPlaylistTrackSnapshots").mockRejectedValue(
      new ApiError(404, "Not Found"),
    );
    const single = vi
      .spyOn(api, "addPlaylistTrack")
      .mockResolvedValue(
        {} as Awaited<ReturnType<typeof api.addPlaylistTrack>>,
      );

    await expect(
      finalizeImportedPlaylist("Mine", undefined, [track]),
    ).resolves.toEqual({ playlistId: "pl_1", saved: 1 });
    expect(single).toHaveBeenCalledWith("pl_1", track.id, track);
  });
});
