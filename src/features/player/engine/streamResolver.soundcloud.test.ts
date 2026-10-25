import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@/shared/contracts";
import type { Track } from "@/shared/types";

const mocks = vi.hoisted(() => ({
  resolveDirectAudioStream: vi.fn(),
  searchRaw: vi.fn(),
  resolveSoundCloudStream: vi.fn(),
}));

vi.mock("@/shared/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/youtube")>();
  return {
    ...actual,
    resolveDirectAudioStream: mocks.resolveDirectAudioStream,
    searchRaw: mocks.searchRaw,
  };
});

vi.mock("@/shared/media/soundcloud", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/media/soundcloud")>();
  return { ...actual, resolveSoundCloudStream: mocks.resolveSoundCloudStream };
});

import { SoundCloudUnavailableError } from "@/shared/media/soundcloud";
import { resolvePlaybackStream } from "./streamResolver";
import { clearYoutubeStandInCache } from "./youtubeStandIn";

const directStream = {
  url: "https://rr1.googlevideo.com/videoplayback?itag=251",
  mimeType: "audio/webm",
  codec: "opus" as const,
  bitrate: 135_000,
  itag: 251,
  expiresAt: "2030-01-01T00:00:00.000Z",
};

function track(
  id: string,
  title = "Blinding Lights",
  artists = "The Weeknd",
  durationMs = 200_000,
): Track {
  return { id, title, artists, durationMs, coverUrl: "", playCount: 0 };
}

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

afterEach(() => {
  vi.restoreAllMocks();
  mocks.resolveDirectAudioStream.mockReset();
  mocks.searchRaw.mockReset();
  mocks.resolveSoundCloudStream.mockReset();
  clearYoutubeStandInCache();
});

describe("resolvePlaybackStream for soundcloud ids", () => {
  it("plays signed soundcloud urls with their expiry", async () => {
    const expiresAt = "2030-01-01T00:00:00.000Z";
    mocks.resolveSoundCloudStream.mockResolvedValue({
      url: "https://cf-media.sndcdn.com/a.mp3",
      mimeType: "audio/mpeg",
      codec: "mp3",
      bitrate: 128_000,
      expiresAt,
    });

    const stream = await resolvePlaybackStream(track("sc:1099045843"));

    expect(mocks.resolveSoundCloudStream).toHaveBeenCalledWith(
      "sc:1099045843",
      { signal: undefined },
    );
    expect(stream).toMatchObject({
      url: "https://cf-media.sndcdn.com/a.mp3",
      expiresAtMs: Date.parse(expiresAt),
    });
  });

  it("passes buffered hls blobs through without an expiry", async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xfb])], {
      type: "audio/mpeg",
    });
    mocks.resolveSoundCloudStream.mockResolvedValue({
      blob,
      mimeType: "audio/mpeg",
      codec: "mp3",
      bitrate: 128_000,
      expiresAt: null,
      contentLength: 2,
    });

    const stream = await resolvePlaybackStream(track("sc:42"));

    expect(stream).toMatchObject({ blob, expiresAtMs: null, contentLength: 2 });
    expect(stream.url).toBeUndefined();
  });

  it("finds the same song on youtube when soundcloud cannot play it", async () => {
    mocks.resolveSoundCloudStream.mockRejectedValue(
      new SoundCloudUnavailableError("preview_only"),
    );
    mocks.searchRaw.mockResolvedValue([
      searchTrack(
        "aaaaaaaaaa1",
        "Blinding Lights (Live)",
        "The Weeknd",
        260_000,
      ),
      searchTrack("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200_040),
    ]);
    mocks.resolveDirectAudioStream.mockResolvedValue(directStream);

    const stream = await resolvePlaybackStream(track("sc:7"));

    expect(mocks.resolveDirectAudioStream).toHaveBeenCalledWith("4NRXx6U8ABQ", {
      signal: undefined,
    });
    expect(stream).toMatchObject({ url: directStream.url });
  });

  it("remembers the youtube stand-in so the next resolve skips the search", async () => {
    mocks.resolveSoundCloudStream.mockRejectedValue(new Error("network down"));
    mocks.searchRaw.mockResolvedValue([
      searchTrack("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200_040),
    ]);
    mocks.resolveDirectAudioStream.mockResolvedValue(directStream);

    await resolvePlaybackStream(track("sc:8"));
    const searches = mocks.searchRaw.mock.calls.length;
    await resolvePlaybackStream(track("sc:8"));

    expect(mocks.searchRaw).toHaveBeenCalledTimes(searches);
  });

  it("surfaces the soundcloud error when every fallback fails", async () => {
    mocks.resolveSoundCloudStream.mockRejectedValue(
      new SoundCloudUnavailableError("not_found"),
    );
    mocks.searchRaw.mockResolvedValue([]);

    await expect(resolvePlaybackStream(track("sc:10"))).rejects.toThrow(
      "not_found",
    );
  });

  it("does not fall back when the request was aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.resolveSoundCloudStream.mockRejectedValue(
      new DOMException("aborted", "AbortError"),
    );

    await expect(
      resolvePlaybackStream(track("sc:11"), controller.signal),
    ).rejects.toThrow("aborted");
    expect(mocks.searchRaw).not.toHaveBeenCalled();
  });
});
