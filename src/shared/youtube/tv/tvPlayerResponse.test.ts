import { describe, expect, it } from "vitest";
import { readTvPlayerResponse } from "./tvPlayerResponse";
import { isBotCheckError } from "../auth/signInRequest";

const playable = {
  playabilityStatus: { status: "OK" },
  streamingData: {
    serverAbrStreamingUrl: "https://rr1.googlevideo.com/videoplayback?n=abc",
    adaptiveFormats: [
      {
        itag: 251,
        bitrate: 140000,
        mimeType: 'audio/webm; codecs="opus"',
        audioQuality: "AUDIO_QUALITY_MEDIUM",
        contentLength: "2458815",
      },
      { mimeType: "broken" },
    ],
  },
  playerConfig: {
    mediaCommonConfig: {
      mediaUstreamerRequestConfig: { videoPlaybackUstreamerConfig: "Cgo=" },
    },
  },
};

describe("readTvPlayerResponse", () => {
  it("extracts the sabr url, ustreamer config and valid formats", () => {
    const data = readTvPlayerResponse(playable);
    expect(data.serverAbrStreamingUrl).toContain("videoplayback");
    expect(data.ustreamerConfig).toBe("Cgo=");
    expect(data.formats).toHaveLength(1);
    expect(data.formats[0]).toMatchObject({
      itag: 251,
      contentLength: "2458815",
    });
  });

  it("surfaces the playability reason", () => {
    expect(() =>
      readTvPlayerResponse({
        playabilityStatus: {
          status: "LOGIN_REQUIRED",
          reason: "Sign in to confirm you’re not a bot",
        },
      }),
    ).toThrow("Sign in to confirm you’re not a bot");
  });
});

describe("isBotCheckError", () => {
  it("recognises bot checks and missing sign-in", () => {
    expect(
      isBotCheckError(
        new Error("VISIONOS: Sign in to confirm you’re not a bot"),
      ),
    ).toBe(true);
    expect(isBotCheckError(new Error("YouTube sign-in is required."))).toBe(
      true,
    );
    expect(isBotCheckError(new Error("stream url rejected with 403"))).toBe(
      false,
    );
  });
});
