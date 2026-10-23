import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult, SourcedSearchResult } from "@/shared/contracts";

const mocks = vi.hoisted(() => ({
  youtubeSearch: vi.fn(),
  soundcloudSearch: vi.fn(),
  resolveSoundCloudUrl: vi.fn(),
  isSoundCloudUrl: vi.fn((value: string) => value.includes("soundcloud.com")),
}));

vi.mock("@/shared/media/innertube", () => ({
  innertubeCatalog: { search: mocks.youtubeSearch },
}));

vi.mock("@/shared/media/soundcloud", () => ({
  soundcloudCatalog: { search: mocks.soundcloudSearch },
  resolveSoundCloudUrl: mocks.resolveSoundCloudUrl,
  isSoundCloudUrl: mocks.isSoundCloudUrl,
}));

import { searchCatalogs } from "./catalogSearch";

function rawTrack(id: string, title = id): SearchResult {
  return { type: "track", id, title, artists: [], durationMs: 1 };
}

function sourcedTrack(id: string, source: "youtube" | "soundcloud"): SourcedSearchResult {
  return { ...rawTrack(id), source };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSoundCloudUrl.mockImplementation((value: string) => value.includes("soundcloud.com"));
});

describe("searchCatalogs", () => {
  it("routes youtube without calling soundcloud", async () => {
    mocks.youtubeSearch.mockResolvedValue([rawTrack("yt-1")]);
    const server = vi.fn();

    await expect(searchCatalogs("weeknd", "track", "youtube", server)).resolves.toEqual({
      items: [sourcedTrack("yt-1", "youtube")],
    });
    expect(mocks.soundcloudSearch).not.toHaveBeenCalled();
    expect(server).not.toHaveBeenCalled();
  });

  it("routes soundcloud without calling youtube or server", async () => {
    mocks.soundcloudSearch.mockResolvedValue([sourcedTrack("sc:1", "soundcloud")]);
    const server = vi.fn();

    await expect(searchCatalogs("weeknd", "track", "soundcloud", server)).resolves.toEqual({
      items: [sourcedTrack("sc:1", "soundcloud")],
    });
    expect(mocks.youtubeSearch).not.toHaveBeenCalled();
    expect(server).not.toHaveBeenCalled();
  });

  it("annotates youtube client and server-fallback results", async () => {
    mocks.youtubeSearch.mockResolvedValueOnce([rawTrack("client")]);
    await expect(
      searchCatalogs("weeknd", "track", "youtube", vi.fn()),
    ).resolves.toEqual({ items: [sourcedTrack("client", "youtube")] });

    mocks.youtubeSearch.mockRejectedValueOnce(new Error("client unavailable"));
    const server = vi.fn().mockResolvedValue({ items: [rawTrack("server")] });
    await expect(searchCatalogs("weeknd", "track", "youtube", server)).resolves.toEqual({
      items: [sourcedTrack("server", "youtube")],
    });
  });

  it("interleaves all results while preserving provider ranking", async () => {
    mocks.youtubeSearch.mockResolvedValue([rawTrack("youtube-1"), rawTrack("youtube-2")]);
    mocks.soundcloudSearch.mockResolvedValue([
      sourcedTrack("soundcloud-1", "soundcloud"),
      sourcedTrack("soundcloud-2", "soundcloud"),
    ]);

    const result = await searchCatalogs("weeknd", "track", "all", vi.fn());

    expect(result.items.map((item) => item.id)).toEqual([
      "youtube-1",
      "soundcloud-1",
      "youtube-2",
      "soundcloud-2",
    ]);
  });

  it("keeps same type and id from different sources", async () => {
    mocks.youtubeSearch.mockResolvedValue([rawTrack("same")]);
    mocks.soundcloudSearch.mockResolvedValue([sourcedTrack("same", "soundcloud")]);

    const result = await searchCatalogs("weeknd", "track", "all", vi.fn());

    expect(result.items).toEqual([
      sourcedTrack("same", "youtube"),
      sourcedTrack("same", "soundcloud"),
    ]);
  });

  it("reports soundcloud failure while returning youtube results", async () => {
    mocks.youtubeSearch.mockResolvedValue([rawTrack("yt-1")]);
    mocks.soundcloudSearch.mockRejectedValue(new Error("soundcloud unavailable"));

    await expect(searchCatalogs("weeknd", "track", "all", vi.fn())).resolves.toEqual({
      items: [sourcedTrack("yt-1", "youtube")],
      failedSources: ["soundcloud"],
    });
  });

  it("reports youtube failure while returning soundcloud results", async () => {
    mocks.youtubeSearch.mockRejectedValue(new Error("youtube unavailable"));
    mocks.soundcloudSearch.mockResolvedValue([sourcedTrack("sc:1", "soundcloud")]);
    const server = vi.fn().mockRejectedValue(new Error("server unavailable"));

    await expect(searchCatalogs("weeknd", "track", "all", server)).resolves.toEqual({
      items: [sourcedTrack("sc:1", "soundcloud")],
      failedSources: ["youtube"],
    });
  });

  it("rejects when both all-source providers fail", async () => {
    const youtubeError = new Error("youtube unavailable");
    mocks.youtubeSearch.mockRejectedValue(youtubeError);
    mocks.soundcloudSearch.mockRejectedValue(new Error("soundcloud unavailable"));
    const server = vi.fn().mockRejectedValue(youtubeError);

    await expect(searchCatalogs("weeknd", "track", "all", server)).rejects.toBe(youtubeError);
  });

  it("resolves a SoundCloud URL only for all or soundcloud source", async () => {
    const url = "https://soundcloud.com/u/t";
    mocks.resolveSoundCloudUrl.mockResolvedValue([rawTrack("sc:9")]);
    mocks.youtubeSearch.mockResolvedValue([rawTrack("youtube-url-query")]);

    await searchCatalogs(url, "track", "all", vi.fn());
    await searchCatalogs(url, "track", "soundcloud", vi.fn());
    const youtube = await searchCatalogs(url, "track", "youtube", vi.fn());

    expect(mocks.resolveSoundCloudUrl).toHaveBeenCalledTimes(2);
    expect(mocks.soundcloudSearch).not.toHaveBeenCalled();
    expect(youtube.items).toEqual([sourcedTrack("youtube-url-query", "youtube")]);
  });

  it("forwards one AbortSignal to selected providers and server fallback", async () => {
    const controller = new AbortController();
    const server = vi.fn().mockResolvedValue({ items: [rawTrack("fallback")] });
    mocks.youtubeSearch.mockRejectedValue(new Error("client unavailable"));
    mocks.soundcloudSearch.mockResolvedValue([]);

    await searchCatalogs("weeknd", "track", "all", server, controller.signal);

    expect(mocks.youtubeSearch).toHaveBeenCalledWith("weeknd", "track", controller.signal);
    expect(mocks.soundcloudSearch).toHaveBeenCalledWith("weeknd", "track", controller.signal);
    expect(server).toHaveBeenCalledOnce();
  });
});
