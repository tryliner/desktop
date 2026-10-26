import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/shared/types";

const mocks = vi.hoisted(() => ({ resolveSoundCloudStream: vi.fn() }));

vi.mock("@/shared/media/soundcloud", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/media/soundcloud")>();
  return { ...actual, resolveSoundCloudStream: mocks.resolveSoundCloudStream };
});

import { linerDb } from "@/shared/storage";
import { playerRuntime } from "./playerRuntime";

function soundCloudTrack(id: string): Track {
  return {
    id,
    title: "Love Potions",
    artists: "Artist",
    durationMs: 173_000,
    coverUrl: "",
    playCount: 0,
  };
}

function bufferedStream(bytes: number[]) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "audio/mp4" });
  return {
    blob,
    mimeType: "audio/mp4",
    codec: "aac",
    bitrate: 160_000,
    expiresAt: null,
    contentLength: bytes.length,
  };
}

beforeEach(() => {
  if (!URL.createObjectURL) URL.createObjectURL = () => "";
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:soundcloud-buffer");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.resolveSoundCloudStream.mockReset();
});

describe("PlayerRuntime with soundcloud streams", () => {
  it("plays a buffered hls blob through an object url and caches it without downloading again", async () => {
    mocks.resolveSoundCloudStream.mockResolvedValue(bufferedStream([1, 2, 3]));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const track = soundCloudTrack("sc:101");

    await playerRuntime!.loadAndPlay(track);

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(playerRuntime!.hasLoadedSourceFor(track.id)).toBe(true);
    await vi.waitFor(async () =>
      expect((await linerDb.getAudio(track.id))?.byteSize).toBe(3),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preloads a buffered soundcloud stream straight into the audio cache", async () => {
    mocks.resolveSoundCloudStream.mockResolvedValue(bufferedStream([4, 5]));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await playerRuntime!.preloadTrack(soundCloudTrack("sc:102"));

    expect((await linerDb.getAudio("sc:102"))?.byteSize).toBe(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats an expired signed progressive url as needing a fresh resolve", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    mocks.resolveSoundCloudStream.mockResolvedValue({
      url: "https://cf-media.sndcdn.com/a.mp3?Expires=1893456600",
      mimeType: "audio/mpeg",
      codec: "mp3",
      bitrate: 128_000,
      expiresAt: "2030-01-01T00:10:00.000Z",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([7]), {
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    const track = soundCloudTrack("sc:103");

    await playerRuntime!.loadAndPlay(track);
    expect(playerRuntime!.hasLoadedSourceFor(track.id)).toBe(true);

    vi.setSystemTime(new Date("2030-01-01T00:09:50.000Z"));
    expect(playerRuntime!.hasLoadedSourceFor(track.id)).toBe(false);
    vi.useRealTimers();
  });

  it("keeps the previous source attached while the next track resolves (system media session survives skips)", async () => {
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const removeSrc = vi.spyOn(HTMLMediaElement.prototype, "removeAttribute");
    mocks.resolveSoundCloudStream.mockResolvedValueOnce(bufferedStream([1]));
    await playerRuntime!.loadAndPlay(soundCloudTrack("sc:201"));
    removeSrc.mockClear();

    let release!: (value: unknown) => void;
    mocks.resolveSoundCloudStream.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const pending = playerRuntime!.loadAndPlay(soundCloudTrack("sc:202"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const audio = (playerRuntime as any).audio as HTMLAudioElement;
    // mid-skip: the element is never emptied, and the old source doesn't count as the new track
    expect(removeSrc).not.toHaveBeenCalledWith("src");
    expect(audio.getAttribute("src")).toBe("blob:first");
    expect(playerRuntime!.hasLoadedSourceFor("sc:202")).toBe(false);

    release(bufferedStream([2]));
    await pending;
    expect(audio.getAttribute("src")).toBe("blob:second");
    expect(playerRuntime!.hasLoadedSourceFor("sc:202")).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first");
    // two full loads; each waits up to 3s for a canplay jsdom never fires
  }, 20_000);
});
