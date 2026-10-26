import { afterEach, describe, expect, it, vi } from "vitest";

const { getClientVisitorData, resetClientVisitorData } = vi.hoisted(() => ({
  getClientVisitorData: vi.fn(),
  resetClientVisitorData: vi.fn(),
}));

vi.mock("../session/visitorSession", () => ({ getClientVisitorData, resetClientVisitorData }));

import { InnertubeError, postInnertube } from "./innertubeClient";

function reply(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("postInnertube", () => {
  it("retries once with a fresh visitor session when youtube rejects the first one", async () => {
    getClientVisitorData.mockResolvedValueOnce("stale").mockResolvedValueOnce("fresh");
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(403)).mockResolvedValueOnce(reply(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postInnertube("browse", { browseId: "UClYV6hHlupm_S_ObS1W-DYw" })).resolves.toEqual({ ok: true });

    expect(resetClientVisitorData).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(retryHeaders["x-goog-visitor-id"]).toBe("fresh");
  });

  it("gives up after the retry is rejected too", async () => {
    getClientVisitorData.mockResolvedValue("v");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(403)));

    await expect(postInnertube("browse", { browseId: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(postInnertube("browse", { browseId: "x" })).rejects.toBeInstanceOf(InnertubeError);
  });

  it("does not retry other failures", async () => {
    getClientVisitorData.mockResolvedValue("v");
    const fetchMock = vi.fn().mockResolvedValue(reply(500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postInnertube("search", { query: "q" })).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resetClientVisitorData).not.toHaveBeenCalled();
  });
});
