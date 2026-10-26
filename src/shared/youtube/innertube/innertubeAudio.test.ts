import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resetClientVisitorData, webRemix, webPlayer } = vi.hoisted(() => ({
  resetClientVisitorData: vi.fn(),
  webRemix: { resolve: vi.fn(), reset: vi.fn() },
  webPlayer: { signature_timestamp: 20_300, decipher: vi.fn() },
}));

vi.mock("./webRemixAudio", () => ({
  resolveWebRemixAudioStream: webRemix.resolve,
  resetWebRemixSession: webRemix.reset,
  getWebPlayer: async () => webPlayer,
}));

vi.mock("../session/visitorSession", () => ({
  getClientVisitorData: async () => "CgtVISITOR123",
  resetClientVisitorData,
}));

import {
  resetPlaybackProfilePreference,
  resolveDirectAudioStream,
  toVideoId,
} from "./innertubeAudio";
import {
  selectBestAudioFormat,
  type AudioFormat,
} from "./innertubeAudioFormats";

const expire = Math.floor(Date.UTC(2030, 0, 1) / 1000);
const opus: AudioFormat = {
  itag: 251,
  url: `https://rr1.googlevideo.com/videoplayback?itag=251&expire=${expire}`,
  mimeType: 'audio/webm; codecs="opus"',
  bitrate: 135_000,
};
const aac: AudioFormat = {
  itag: 140,
  url: "https://rr1.googlevideo.com/videoplayback?itag=140",
  mimeType: 'audio/mp4; codecs="mp4a.40.2"',
  bitrate: 130_000,
};
const low: AudioFormat = {
  itag: 249,
  url: "https://rr1.googlevideo.com/videoplayback?itag=249",
  mimeType: 'audio/webm; codecs="opus"',
  bitrate: 50_000,
};

function playerResponse(formats: unknown[], status = "OK") {
  return new Response(
    JSON.stringify({
      playabilityStatus: {
        status,
        reason: status === "OK" ? undefined : "Sign in to confirm",
      },
      streamingData: { adaptiveFormats: formats },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

type FetchInput = Parameters<typeof fetch>[0];

function isStreamProbe(input: FetchInput): boolean {
  return String(input).includes("googlevideo.com/");
}

function mockPlayerApi(
  playerResponses: Response[],
  probeStatus: (url: string) => number = () => 206,
) {
  const queue = [...playerResponses];
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: FetchInput) => {
      if (isStreamProbe(input))
        return new Response(null, { status: probeStatus(String(input)) });
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (!next) throw new Error("no player response queued");
      return next.clone();
    });
}

function playerCalls(fetchSpy: ReturnType<typeof mockPlayerApi>) {
  return fetchSpy.mock.calls.filter(([input]) => !isStreamProbe(input));
}

beforeEach(() => {
  webRemix.resolve.mockRejectedValue(
    new Error("WEB_REMIX unavailable in tests"),
  );
  webPlayer.decipher.mockImplementation(
    async (url?: string, cipher?: string) =>
      url
        ? `${url}&n=deciphered`
        : `https://rr1.googlevideo.com/videoplayback?itag=251&${cipher}`,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  resetClientVisitorData.mockClear();
  webRemix.resolve.mockReset();
  webRemix.reset.mockClear();
  resetPlaybackProfilePreference();
});

describe("audio format selection", () => {
  it("prefers opus 251, then aac 140", () => {
    expect(selectBestAudioFormat([low, aac, opus])?.itag).toBe(251);
    expect(selectBestAudioFormat([low, aac])?.itag).toBe(140);
    expect(selectBestAudioFormat([aac, opus], "aac")?.itag).toBe(140);
  });

  it("returns null when there are no direct audio formats", () => {
    expect(selectBestAudioFormat([])).toBeNull();
  });
});

describe("resolveDirectAudioStream", () => {
  it("resolves opus through the TV profile with a deciphered url and the player signature timestamp", async () => {
    const fetchSpy = mockPlayerApi([
      playerResponse([
        { ...aac },
        { itag: 251, signatureCipher: "s=abc", mimeType: opus.mimeType },
        { itag: 18, url: "https://x", mimeType: "video/mp4" },
      ]),
    ]);
    const stream = await resolveDirectAudioStream("dQw4w9WgXcQ");

    expect(stream).toMatchObject({
      itag: 251,
      codec: "opus",
      mimeType: "audio/webm",
    });
    expect(stream.url).toBe(
      "https://rr1.googlevideo.com/videoplayback?itag=251&s=abc",
    );
    expect(webPlayer.decipher).toHaveBeenCalledWith(undefined, "s=abc");

    const [url, init] = playerCalls(fetchSpy)[0];
    expect(url).toBe(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    );
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-youtube-client-name"]).toBe("7");
    expect(headers["x-goog-visitor-id"]).toBe("CgtVISITOR123");
    expect(headers["x-liner-user-agent"]).toContain("Cobalt");
    const body = JSON.parse(String(init?.body));
    expect(body.videoId).toBe("dQw4w9WgXcQ");
    expect(body.playbackContext.contentPlaybackContext.signatureTimestamp).toBe(
      20_300,
    );
    expect(body.context.client).toMatchObject({
      clientName: "TVHTML5",
      visitorData: "CgtVISITOR123",
    });
  });

  it("refreshes visitorData and retries once when youtube asks for a bot check", async () => {
    const fetchSpy = mockPlayerApi([
      playerResponse([], "LOGIN_REQUIRED"),
      playerResponse([opus]),
    ]);
    const stream = await resolveDirectAudioStream("dQw4w9WgXcQ");

    expect(resetClientVisitorData).toHaveBeenCalledTimes(1);
    expect(stream).toMatchObject({
      itag: 251,
      url: `${opus.url}&n=deciphered`,
    });
    expect(playerCalls(fetchSpy)).toHaveLength(2);
  });

  it("falls back to VISIONOS without deciphering when TV is not playable", async () => {
    const fetchSpy = mockPlayerApi([
      playerResponse([], "UNPLAYABLE"),
      playerResponse([aac]),
    ]);
    const stream = await resolveDirectAudioStream("yt:dQw4w9WgXcQ");

    expect(stream).toMatchObject({
      itag: 140,
      codec: "aac",
      mimeType: "audio/mp4",
      url: aac.url,
    });
    const body = JSON.parse(String(playerCalls(fetchSpy)[1][1]?.body));
    expect(body.context.client).toMatchObject({
      clientName: "VISIONOS",
      clientVersion: "1.02",
      osVersion: "26.5.23O471",
    });
    expect(body.playbackContext).toBeUndefined();
  });

  it("falls back to VISIONOS when googlevideo rejects the TV stream url, and starts with it next time", async () => {
    const fetchSpy = mockPlayerApi(
      [playerResponse([opus]), playerResponse([aac])],
      (url) => (url.includes("n=deciphered") ? 403 : 206),
    );

    const stream = await resolveDirectAudioStream("dQw4w9WgXcQ");
    expect(stream.itag).toBe(140);

    fetchSpy.mockClear();
    await resolveDirectAudioStream("dQw4w9WgXcQ");
    expect(
      JSON.parse(String(playerCalls(fetchSpy)[0][1]?.body)).context.client
        .clientName,
    ).toBe("VISIONOS");
  });

  it("reports every profile failure when nothing is playable", async () => {
    mockPlayerApi([playerResponse([], "UNPLAYABLE")]);
    await expect(resolveDirectAudioStream("dQw4w9WgXcQ")).rejects.toThrow(
      /TVHTML5.*VISIONOS.*ANDROID_VR/,
    );
  });

  it("plays the WEB_REMIX stream with its po token when googlevideo accepts it past the first megabyte", async () => {
    const webUrl =
      "https://rr1.googlevideo.com/videoplayback?itag=251&c=WEB_REMIX&pot=token";
    webRemix.resolve.mockResolvedValue({
      url: webUrl,
      mimeType: "audio/webm",
      codec: "opus",
      bitrate: 140_000,
      itag: 251,
      expiresAt: null,
      contentLength: 3_000_000,
    });
    const fetchSpy = mockPlayerApi([playerResponse([opus])]);

    const stream = await resolveDirectAudioStream("dQw4w9WgXcQ");

    expect(stream.url).toBe(webUrl);
    expect(playerCalls(fetchSpy)).toHaveLength(0);
    const probeRange = new URL(
      String(fetchSpy.mock.calls[0][0]),
    ).searchParams.get("range");
    expect(Number(probeRange?.split("-")[0])).toBeGreaterThan(1_048_576);
  });

  it("retries WEB_REMIX with a fresh token, falls back to the app profiles, and only pauses it after repeated failures", async () => {
    webRemix.resolve.mockRejectedValue(
      new Error("Sign in to confirm you're not a bot"),
    );
    mockPlayerApi([playerResponse([opus])]);

    await expect(
      resolveDirectAudioStream("dQw4w9WgXcQ"),
    ).resolves.toMatchObject({ itag: 251 });
    expect(webRemix.resolve).toHaveBeenCalledTimes(2);
    expect(webRemix.reset).toHaveBeenCalledTimes(2);

    await resolveDirectAudioStream("dQw4w9WgXcQ");
    await resolveDirectAudioStream("dQw4w9WgXcQ");
    expect(webRemix.resolve).toHaveBeenCalledTimes(6);

    await resolveDirectAudioStream("dQw4w9WgXcQ");
    expect(webRemix.resolve).toHaveBeenCalledTimes(6);
  });

  it("falls back when googlevideo rejects the WEB_REMIX stream", async () => {
    const webUrl =
      "https://rr1.googlevideo.com/videoplayback?itag=251&c=WEB_REMIX";
    webRemix.resolve.mockResolvedValue({
      url: webUrl,
      mimeType: "audio/webm",
      codec: "opus",
      bitrate: 140_000,
      itag: 251,
      expiresAt: null,
      contentLength: 3_000_000,
    });
    mockPlayerApi([playerResponse([aac])], (url) =>
      url.includes("c=WEB_REMIX") ? 403 : 206,
    );

    await expect(
      resolveDirectAudioStream("dQw4w9WgXcQ"),
    ).resolves.toMatchObject({ itag: 140 });
  });

  it("rejects non-youtube ids without any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(toVideoId("sc:12345")).toBeNull();
    await expect(resolveDirectAudioStream("sc:12345")).rejects.toThrow(
      /not a YouTube video/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
