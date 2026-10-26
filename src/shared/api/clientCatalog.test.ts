import { beforeEach, describe, expect, it, vi } from "vitest";

const getTrack = vi.fn();

vi.mock("@/shared/youtube", () => ({
  innertubeCatalog: { getTrack: (...args: unknown[]) => getTrack(...args) },
}));

import { clientCatalog } from "./clientCatalog";

describe("clientCatalog.resolveSnapshot", () => {
  beforeEach(() => getTrack.mockReset());

  it("keeps the requested id even when the catalog returns a different one", async () => {
    getTrack.mockResolvedValue({
      id: "CANONICAL_VIDEO_ID",
      title: "addiction (Slowed)",
      artists: "LONOWN, Asenssia",
      durationMs: 120000,
    });
    const snapshot = await clientCatalog.resolveSnapshot("PLAYING_TRACK_ID");
    expect(snapshot?.id).toBe("PLAYING_TRACK_ID");
    expect(snapshot?.title).toBe("addiction (Slowed)");
  });

  it("returns undefined for server-only ids without calling the catalog", async () => {
    expect(await clientCatalog.resolveSnapshot("sc:123")).toBeUndefined();
    expect(getTrack).not.toHaveBeenCalled();
  });
});
