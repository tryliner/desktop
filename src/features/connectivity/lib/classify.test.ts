import { describe, expect, it } from "vitest";
import {
  classifyConnection,
  connectionIssue,
  issueGroup,
  issueResolved,
  youtubeReach,
  type ConnectionProbe,
} from "./classify";

const base: ConnectionProbe = {
  deviceOnline: true,
  api: { ok: true, status: 200 },
  internet: true,
  youtube: true,
  country: "DE",
};

describe("classifyConnection", () => {
  it("is online whenever the api answers", () => {
    expect(classifyConnection({ ...base, internet: false })).toBe("online");
  });

  it("is offline when the os reports no network", () => {
    expect(
      classifyConnection({ ...base, deviceOnline: false, api: { ok: false } }),
    ).toBe("offline");
  });

  it("blames the server for 5xx answers", () => {
    expect(
      classifyConnection({ ...base, api: { ok: false, status: 503 } }),
    ).toBe("server_error");
  });

  it("calls the server unreachable when the rest of the internet works", () => {
    expect(classifyConnection({ ...base, api: { ok: false } })).toBe(
      "server_unreachable",
    );
  });

  it("is offline when neither the api nor the controls answer", () => {
    expect(
      classifyConnection({ ...base, api: { ok: false }, internet: false }),
    ).toBe("offline");
  });

  it("falls back to offline without the desktop probe", () => {
    expect(
      classifyConnection({ ...base, api: { ok: false }, internet: null }),
    ).toBe("offline");
  });
});

describe("youtubeReach", () => {
  it("flags youtube as blocked only when the internet works", () => {
    expect(youtubeReach({ ...base, youtube: false })).toBe("blocked");
    expect(youtubeReach({ ...base, youtube: false, internet: false })).toBe(
      "unknown",
    );
    expect(youtubeReach(base)).toBe("ok");
    expect(youtubeReach({ ...base, youtube: null })).toBe("unknown");
  });
});

describe("youtubeReach failure kinds", () => {
  it("tells a hung youtube from a blocked one", () => {
    expect(
      youtubeReach({ ...base, youtube: false, youtubeFailure: "timeout" }),
    ).toBe("unreachable");
    expect(
      youtubeReach({ ...base, youtube: false, youtubeFailure: "blocked" }),
    ).toBe("blocked");
  });
});

describe("connectionIssue", () => {
  it("puts device and server problems ahead of youtube", () => {
    expect(connectionIssue("offline", "blocked")).toBe("offline");
    expect(connectionIssue("server_unreachable", "blocked")).toBe("server");
    expect(connectionIssue("server_error", "ok")).toBe("server");
    expect(connectionIssue("online", "blocked")).toBe("youtube_blocked");
    expect(connectionIssue("online", "unreachable")).toBe(
      "youtube_unreachable",
    );
    expect(connectionIssue("online", "ok")).toBeNull();
    expect(connectionIssue("online", "unknown")).toBeNull();
  });

  it("groups the three youtube issues together", () => {
    expect(issueGroup("youtube_refused")).toBe("youtube");
    expect(issueGroup("youtube_blocked")).toBe("youtube");
    expect(issueGroup("server")).toBe("server");
    expect(issueGroup("offline")).toBe("offline");
  });

  it("only clears a youtube issue once youtube answers", () => {
    expect(issueResolved("youtube", "online", "blocked")).toBe(false);
    expect(issueResolved("youtube", "online", "ok")).toBe(true);
    expect(issueResolved("server", "online", "blocked")).toBe(true);
    expect(issueResolved("offline", "server_unreachable", "ok")).toBe(false);
  });
});
