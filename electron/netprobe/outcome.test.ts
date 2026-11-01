import { describe, expect, it } from "vitest";
import { youtubeFailureOf } from "./outcome";

describe("youtubeFailureOf", () => {
  it("is fine when youtube answers 204", () => {
    expect(youtubeFailureOf({ status: 204, body: "" })).toBeNull();
  });

  it("calls a hung probe a timeout", () => {
    expect(youtubeFailureOf({ error: "timeout" })).toBe("timeout");
  });

  it("calls refused connections and isp block pages a block", () => {
    expect(youtubeFailureOf({ error: "failed" })).toBe("blocked");
    expect(youtubeFailureOf({ status: 302, body: "" })).toBe("blocked");
    expect(youtubeFailureOf({ status: 451, body: "" })).toBe("blocked");
  });
});
