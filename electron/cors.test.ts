import { describe, expect, it } from "vitest";
import { withOpenCors } from "./cors";

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
