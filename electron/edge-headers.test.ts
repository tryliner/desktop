import { describe, expect, it } from "vitest";
import {
  isEdgeUrl,
  rememberOrigin,
  setEdgeKey,
  takeOrigin,
  withEdgeHeaders,
} from "./edge-headers";

const KEY = "k".repeat(32);

describe("edge headers", () => {
  it("covers the api hosts over https only", () => {
    expect(isEdgeUrl("https://api.tryliner.fun/v1/me")).toBe(true);
    expect(isEdgeUrl("https://beta.tryliner.fun/health")).toBe(true);
    expect(isEdgeUrl("https://staging.tryliner.fun/v1/me")).toBe(true);
    expect(isEdgeUrl("http://api.tryliner.fun/v1/me")).toBe(false);
    expect(isEdgeUrl("https://link.tryliner.fun/track?id=x")).toBe(false);
    expect(isEdgeUrl("https://api.tryliner.fun.evil.example/")).toBe(false);
    expect(isEdgeUrl("not a url")).toBe(false);
  });

  it("adds the edge key and the clearance cookie, putting the newest clearance before an older one the request carries", () => {
    const state = { key: KEY, clearance: "abc.def-123_456789" };
    expect(withEdgeHeaders({ Accept: "*/*" }, state)).toEqual({
      Accept: "*/*",
      "x-liner-edge": KEY,
      Cookie: "cf_clearance=abc.def-123_456789",
    });
    expect(
      withEdgeHeaders({ cookie: "a=1", "X-Liner-Edge": "own" }, state),
    ).toEqual({
      "X-Liner-Edge": "own",
      Cookie: "cf_clearance=abc.def-123_456789; a=1",
    });
    expect(
      withEdgeHeaders({ Cookie: "cf_clearance=stale; b=2" }, state),
    ).toEqual({
      Cookie: "cf_clearance=abc.def-123_456789; cf_clearance=stale; b=2",
      "x-liner-edge": KEY,
    });
  });

  it("sends nothing it does not hold", () => {
    expect(withEdgeHeaders({ A: "1" }, { key: null, clearance: null })).toEqual(
      { A: "1" },
    );
  });

  it("takes only a well formed key", () => {
    setEdgeKey(KEY);
    expect(withEdgeHeaders({})["x-liner-edge"]).toBe(KEY);
    setEdgeKey("bad key with spaces");
    expect(withEdgeHeaders({})["x-liner-edge"]).toBeUndefined();
    setEdgeKey(KEY);
    setEdgeKey(null);
    expect(withEdgeHeaders({})["x-liner-edge"]).toBeUndefined();
  });

  it("hands back the origin of a request once", () => {
    rememberOrigin(7, { Origin: "http://localhost:5173" });
    rememberOrigin(8, { Accept: "*/*" });
    expect(takeOrigin(7)).toBe("http://localhost:5173");
    expect(takeOrigin(7)).toBeUndefined();
    expect(takeOrigin(8)).toBeUndefined();
    expect(takeOrigin(9, "http://localhost:5173/#/home")).toBe(
      "http://localhost:5173",
    );
    expect(takeOrigin(10, "file:///C:/app/index.html")).toBe("file://");
    expect(takeOrigin(11, "")).toBeUndefined();
  });
});
