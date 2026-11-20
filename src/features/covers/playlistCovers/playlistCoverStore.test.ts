import { describe, it, expect, vi, beforeEach } from "vitest";

const apiMock = vi.hoisted(() => ({
  setPlaylistCover: vi.fn(),
  removePlaylistCover: vi.fn(),
}));

vi.mock("@/shared/api", () => {
  class ApiError extends Error {
    constructor(public status: number) {
      super(`api ${status}`);
    }
  }
  return {
    api: apiMock,
    ApiError,
    mediaUrl: (path: string) => path,
  };
});

import { ApiError } from "@/shared/api";
import {
  MAX_UPLOAD_BYTES,
  PlaylistCoverError,
  usePlaylistCoversStore,
} from "./playlistCoverStore";

const store = () => usePlaylistCoversStore.getState();
const image = (size = 4) =>
  new Blob([new Uint8Array(size)], { type: "image/webp" });

describe("playlist cover store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store().reset();
  });

  it("uploads the image as base64 and shows the server url", async () => {
    apiMock.setPlaylistCover.mockResolvedValue({
      id: "p1",
      coverUrl: "https://cdn.example/p1.webp?v=2",
    });
    const url = await store().setCover("p1", image());
    expect(apiMock.setPlaylistCover).toHaveBeenCalledWith("p1", {
      image: "AAAAAA==",
      contentType: "image/webp",
    });
    expect(url).toBe("https://cdn.example/p1.webp?v=2");
    expect(store().overrides.p1).toBe(url);
  });

  it("refuses images over the upload limit without a request", async () => {
    await expect(
      store().setCover("p1", image(MAX_UPLOAD_BYTES + 1)),
    ).rejects.toMatchObject({ reason: "too-large" });
    expect(apiMock.setPlaylistCover).not.toHaveBeenCalled();
  });

  it("reports a server without the cover endpoint as unavailable", async () => {
    apiMock.setPlaylistCover.mockRejectedValue(new ApiError(404, "missing"));
    const error = await store()
      .setCover("p1", image())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlaylistCoverError);
    expect(error).toMatchObject({ reason: "unavailable" });
  });

  it("hides the cover at once and brings it back if removal fails", async () => {
    usePlaylistCoversStore.setState({ overrides: { p1: "https://a/1" } });
    let fail: (error: Error) => void = () => undefined;
    apiMock.removePlaylistCover.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const pending = store().removeCover("p1");
    expect(store().overrides.p1).toBeNull();
    fail(new Error("offline"));
    await expect(pending).rejects.toMatchObject({ reason: "failed" });
    expect(store().overrides.p1).toBe("https://a/1");
  });

  it("keeps the mosaic after a successful removal", async () => {
    apiMock.removePlaylistCover.mockResolvedValue({ id: "p1", coverUrl: null });
    await store().removeCover("p1");
    expect(store().overrides.p1).toBeNull();
  });
});
