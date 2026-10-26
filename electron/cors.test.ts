import { describe, expect, it } from "vitest";
import { needsOpenCors, withOpenCors } from "./cors";

describe("withOpenCors", () => {
  it("replaces server cors headers instead of duplicating them", () => {
    const { responseHeaders, statusLine } = withOpenCors(
      {
        "Access-Control-Allow-Origin": ["https://music.youtube.com"],
        "Content-Type": ["application/json"],
      },
      "POST",
    );
    expect(responseHeaders["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(responseHeaders["access-control-allow-origin"]).toEqual(["*"]);
    expect(responseHeaders["Content-Type"]).toEqual(["application/json"]);
    expect(responseHeaders["access-control-allow-methods"][0]).toContain(
      "POST",
    );
    expect(statusLine).toBeUndefined();
  });

  it("answers preflight requests with 200", () => {
    expect(withOpenCors({}, "OPTIONS").statusLine).toBe("HTTP/1.1 200 OK");
  });
});

describe("needsOpenCors", () => {
  it("allows the hosts the renderer calls and their subdomains", () => {
    expect(
      needsOpenCors("https://rr1---sn-abc.googlevideo.com/videoplayback"),
    ).toBe(true);
    expect(needsOpenCors("https://music.youtube.com/youtubei/v1/browse")).toBe(
      true,
    );
    expect(needsOpenCors("https://api.tryliner.fun/v1/me")).toBe(true);
    expect(needsOpenCors("https://cf-hls-media.sndcdn.com/a.m3u8")).toBe(true);
  });

  it("leaves other hosts alone", () => {
    expect(needsOpenCors("https://example.com/")).toBe(false);
    expect(needsOpenCors("https://evilyoutube.com/")).toBe(false);
    expect(needsOpenCors("https://youtube.com.evil.com/")).toBe(false);
    expect(needsOpenCors("http://192.168.1.1/")).toBe(false);
    expect(needsOpenCors("file:///C:/index.html")).toBe(false);
    expect(needsOpenCors("not a url")).toBe(false);
  });

  it("allows loopback only when asked", () => {
    expect(needsOpenCors("http://localhost:1337/v1/me")).toBe(false);
    expect(needsOpenCors("http://localhost:1337/v1/me", true)).toBe(true);
    expect(needsOpenCors("http://[::1]:1337/", true)).toBe(true);
  });
});
