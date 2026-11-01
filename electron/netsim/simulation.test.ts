import { describe, expect, it } from "vitest";
import {
  describeNetSimulation,
  parseNetSimulation,
  simulatedFailureFor,
  simulatedStatusLine,
} from "./simulation";

describe("parseNetSimulation", () => {
  it("is off without LINER_SIMULATE", () => {
    expect(parseNetSimulation({})).toBeNull();
    expect(parseNetSimulation({ LINER_SIMULATE: " , " })).toBeNull();
  });

  it("combines scenarios and reads the country override", () => {
    const sim = parseNetSimulation({
      LINER_SIMULATE: "youtube-blocked, Liner-Timeout",
      LINER_SIMULATE_COUNTRY: "ru",
    });
    expect(sim).toEqual({
      youtube: "blocked",
      refuseStreams: false,
      liner: "timeout",
      country: "RU",
      linerOrigins: [],
    });
    expect(describeNetSimulation(sim!)).toBe(
      "youtube blocked, liner timeout, country RU",
    );
  });

  it("rejects typos instead of silently simulating nothing", () => {
    expect(() => parseNetSimulation({ LINER_SIMULATE: "yt-down" })).toThrow(
      /unknown LINER_SIMULATE scenario: yt-down/,
    );
  });

  it("ignores a malformed country", () => {
    expect(
      parseNetSimulation({
        LINER_SIMULATE: "youtube-blocked",
        LINER_SIMULATE_COUNTRY: "Russia",
      })?.country,
    ).toBeNull();
  });
});

describe("simulatedFailureFor", () => {
  const youtubeDown = parseNetSimulation({
    LINER_SIMULATE: "youtube-timeout",
  })!;
  const linerDown = parseNetSimulation({
    LINER_SIMULATE: "liner-down",
    VITE_API_URL: "http://localhost:1337/",
  })!;

  it("fails every youtube host and nothing else", () => {
    for (const url of [
      "https://www.youtube.com/generate_204",
      "https://music.youtube.com/youtubei/v1/player",
      "https://rr3---sn-abc.googlevideo.com/videoplayback?id=1",
      "https://i.ytimg.com/vi/abc/hqdefault.jpg",
      "https://yt3.ggpht.com/avatar",
    ])
      expect(simulatedFailureFor(url, youtubeDown)).toBe("timeout");
    for (const url of [
      "https://www.google.com/generate_204",
      "https://cloudflare.com/cdn-cgi/trace",
      "https://api.tryliner.fun/health",
      "https://notyoutube.com/",
      "liner-local://track/1",
    ])
      expect(simulatedFailureFor(url, youtubeDown)).toBeNull();
  });

  it("fails liner hosts and the configured dev api, but not the dev server", () => {
    expect(
      simulatedFailureFor("https://api.tryliner.fun/v1/me", linerDown),
    ).toBe("blocked");
    expect(
      simulatedFailureFor("https://covers.tryliner.fun/x.jpg", linerDown),
    ).toBe("blocked");
    expect(
      simulatedFailureFor("http://localhost:1337/v1/search", linerDown),
    ).toBe("blocked");
    expect(
      simulatedFailureFor("http://localhost:5173/src/main.tsx", linerDown),
    ).toBeNull();
    expect(
      simulatedFailureFor("https://www.youtube.com/generate_204", linerDown),
    ).toBeNull();
  });
});

describe("simulatedStatusLine", () => {
  const refused = parseNetSimulation({ LINER_SIMULATE: "youtube-refused" })!;

  it("answers 403 to googlevideo streams only", () => {
    expect(
      simulatedStatusLine(
        "https://rr1---sn-x.googlevideo.com/videoplayback?range=0-1",
        "GET",
        refused,
      ),
    ).toBe("HTTP/1.1 403 Forbidden");
    expect(
      simulatedStatusLine(
        "https://music.youtube.com/youtubei/v1/player",
        "POST",
        refused,
      ),
    ).toBeNull();
    expect(
      simulatedStatusLine(
        "https://rr1---sn-x.googlevideo.com/videoplayback",
        "OPTIONS",
        refused,
      ),
    ).toBeNull();
  });

  it("leaves youtube reachable so only playback is refused", () => {
    expect(
      simulatedFailureFor("https://www.youtube.com/generate_204", refused),
    ).toBeNull();
  });
});
