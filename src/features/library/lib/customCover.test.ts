import { describe, it, expect, vi } from "vitest";

vi.mock("@/shared/api", () => ({
  mediaUrl: (path: string) =>
    path.startsWith("/") ? `https://api${path}` : path,
}));

import type { ApiUserPlaylist } from "@/shared/api";
import { customCoverOf, withCustomCover } from "./customCover";

function playlist(coverUrl: string | null): ApiUserPlaylist {
  return {
    id: "p1",
    title: "Mix",
    isPublic: false,
    createdAt: "",
    updatedAt: "",
    revision: 1,
    coverUrl,
  };
}

const mosaic = {
  coverUrl: "https://a/1",
  coverUrls: ["https://a/1", "https://a/2"],
};

describe("custom playlist covers", () => {
  it("resolves the server cover url", () => {
    expect(customCoverOf(playlist("/covers/p1.webp"))).toBe(
      "https://api/covers/p1.webp",
    );
    expect(customCoverOf(playlist(null))).toBeUndefined();
  });

  it("puts the custom cover in place of the mosaic", () => {
    const item = { ...mosaic, customCoverUrl: "https://c/p1" };
    expect(withCustomCover(item, undefined)).toEqual({
      customCoverUrl: "https://c/p1",
      coverUrl: "https://c/p1",
      coverUrls: ["https://c/p1"],
    });
  });

  it("lets a just-saved cover win over what the server sent", () => {
    expect(withCustomCover(mosaic, "https://c/new").coverUrl).toBe(
      "https://c/new",
    );
  });

  it("shows the mosaic again after a removal", () => {
    const item = { ...mosaic, customCoverUrl: "https://c/p1" };
    const result = withCustomCover(item, null);
    expect(result.coverUrls).toEqual(mosaic.coverUrls);
    expect(result.customCoverUrl).toBeUndefined();
  });

  it("returns the same object when there is nothing to change", () => {
    expect(withCustomCover(mosaic, undefined)).toBe(mosaic);
  });
});
