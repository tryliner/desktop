import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAudioBytes } from "./chunkedAudioDownload";

const STREAM_URL =
  "https://rr1---sn-abc.googlevideo.com/videoplayback?expire=1&itag=251";
const source = Uint8Array.from({ length: 2500 }, (_, index) => index % 251);

function rangeServer(failFirstFor?: string) {
  const failed = new Set<string>();
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const range = new URL(String(input)).searchParams.get("range");
    if (!range) return new Response(source.slice(), { status: 200 });
    if (range === failFirstFor && !failed.has(range)) {
      failed.add(range);
      return new Response("busy", { status: 503 });
    }
    const [start, end] = range.split("-").map(Number);
    return new Response(source.slice(start, end + 1), { status: 200 });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadAudioBytes", () => {
  it("downloads googlevideo audio as parallel range chunks and reassembles it in order", async () => {
    const fetchSpy = rangeServer();
    const bytes = await downloadAudioBytes(STREAM_URL, {
      contentLength: source.length,
      chunkSize: 1000,
    });

    expect(bytes).toEqual(source);
    const ranges = fetchSpy.mock.calls
      .map(([input]) => new URL(String(input)).searchParams.get("range"))
      .sort();
    expect(ranges).toEqual(["0-999", "1000-1999", "2000-2499"]);
  });

  it("retries a failed chunk once", async () => {
    rangeServer("1000-1999");
    await expect(
      downloadAudioBytes(STREAM_URL, {
        contentLength: source.length,
        chunkSize: 1000,
      }),
    ).resolves.toEqual(source);
  });

  it("rejects when a chunk comes back short instead of caching a truncated file", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(new Uint8Array(10), { status: 200 }),
    );
    await expect(
      downloadAudioBytes(STREAM_URL, {
        contentLength: source.length,
        chunkSize: 1000,
      }),
    ).rejects.toThrow(/10 of 1000 bytes/);
  });

  it("uses a single request when the size is unknown or the host is not googlevideo", async () => {
    const fetchSpy = rangeServer();
    await expect(downloadAudioBytes(STREAM_URL)).resolves.toEqual(source);
    await expect(
      downloadAudioBytes("https://api.tryliner.fun/v1/playback/pb/media", {
        contentLength: 2500,
      }),
    ).resolves.toEqual(source);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null for a partial single-request response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(4), {
        status: 206,
        headers: { "content-range": "bytes 0-3/1000000" },
      }),
    );
    await expect(
      downloadAudioBytes("https://api.tryliner.fun/v1/playback/pb/media"),
    ).resolves.toBeNull();
  });
});
