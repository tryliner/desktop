import { describe, expect, it } from "vitest";
import { keepsOwnCors, needsOpenCors, withOpenCors } from "./cors";

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

  it("keeps a liner host's own cors headers when it allows credentials", () => {
    const headers = {
      "access-control-allow-origin": ["http://localhost:5173"],
      "access-control-allow-credentials": ["true"],
      "access-control-allow-headers": ["content-type,x-liner-signature"],
    };
    const preflight = withOpenCors(headers, "OPTIONS", true);
    expect(preflight.responseHeaders).toEqual(headers);
    expect(preflight.statusLine).toBeUndefined();
    expect(
      withOpenCors({ "Access-Control-Allow-Credentials": ["false"] }, "GET")
        .responseHeaders["access-control-allow-origin"],
    ).toEqual(["*"]);
  });

  it("opens cors for other hosts even when they allow credentials", () => {
    const { responseHeaders } = withOpenCors(
      {
        "access-control-allow-origin": ["https://music.youtube.com"],
        "access-control-allow-credentials": ["true"],
      },
      "POST",
    );
    expect(responseHeaders["access-control-allow-origin"]).toEqual(["*"]);
    expect(responseHeaders["access-control-allow-credentials"]).toBeUndefined();
  });

  it("answers preflight requests with 200", () => {
    expect(withOpenCors({}, "OPTIONS").statusLine).toBe("HTTP/1.1 200 OK");
  });
});

describe("keepsOwnCors", () => {
  it("keeps cors only for liner hosts and the dev loopback", () => {
    expect(keepsOwnCors("https://api.tryliner.fun/v1/auth/login")).toBe(true);
    expect(
      keepsOwnCors("https://rr4---sn-x.googlevideo.com/videoplayback"),
    ).toBe(false);
    expect(keepsOwnCors("http://localhost:1337/v1/me")).toBe(false);
    expect(keepsOwnCors("http://localhost:1337/v1/me", true)).toBe(true);
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
