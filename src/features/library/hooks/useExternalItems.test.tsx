// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ApiAlbumDetails, type ApiArtistDetails } from "@/shared/api";
import { useExternalItems, type EntityType } from "./useExternalItems";

vi.mock("@/shared/api", () => ({
  api: {
    listSavedCollections: vi.fn(),
    getAlbum: vi.fn(),
    getArtist: vi.fn(),
  },
  mediaUrl: (path: string) => `https://media.example${path.startsWith("/") ? path : `/${path}`}`,
  toMaxQualityAvatarUrl: (url?: string) => url ?? "",
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const savedAt = "2026-10-17T12:00:00.000Z";

const albumDetails: ApiAlbumDetails = {
  type: "album",
  id: "album/one",
  title: "Resolved Album",
  artists: [{ id: "artist-1", name: "Album Artist" }],
  year: 2024,
  cover: { url: "/covers/album.jpg", width: 640, height: 640 },
  trackCount: 10,
  tracks: [],
};

const artistDetails: ApiArtistDetails = {
  type: "artist",
  id: "artist/one",
  name: "Resolved Artist",
  verified: false,
  cover: { url: "/covers/artist.jpg", width: 640, height: 640 },
  tracks: [],
  albums: [],
  singles: [],
};

/** Renders the hook and exposes its current result to a test. */
function HookProbe({
  type,
  onChange,
}: {
  type: EntityType;
  onChange: (value: ReturnType<typeof useExternalItems>) => void;
}) {
  onChange(useExternalItems(type));
  return null;
}

describe("useExternalItems", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: ReturnType<typeof useExternalItems> | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    result = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  /** Mounts the hook for an entity type and lets its initial load settle. */
  async function renderType(type: EntityType) {
    await act(async () => {
      root.render(<HookProbe type={type} onChange={(value) => { result = value; }} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("hydrates a sparse saved album while preserving its id, link, and saved time", async () => {
    vi.mocked(api.listSavedCollections).mockResolvedValue({
      items: [{ savedAt, album: { id: "album/one" } }],
    });
    vi.mocked(api.getAlbum).mockResolvedValue(albumDetails);

    await renderType("album");

    expect(api.getAlbum).toHaveBeenCalledWith("album/one");
    expect(result?.data[0]).toMatchObject({
      id: "album/one",
      title: "Resolved Album",
      imageUrl: "https://media.example/covers/album.jpg",
      href: "/collection?type=album&id=album%2Fone",
      addedAt: savedAt,
    });
  });

  it("preserves hydrated metadata on refresh without repeating a complete lookup", async () => {
    const pendingRefreshDetails = new Promise<ApiAlbumDetails>(() => {});
    let detailCalls = 0;
    const sparseAlbum = { savedAt, album: { id: "album/one" } };
    vi.mocked(api.listSavedCollections)
      .mockResolvedValueOnce({ items: [sparseAlbum] })
      .mockResolvedValueOnce({ items: [sparseAlbum] });
    vi.mocked(api.getAlbum).mockImplementation(() => {
      detailCalls += 1;
      return detailCalls === 1 ? Promise.resolve(albumDetails) : pendingRefreshDetails;
    });

    await renderType("album");
    expect(result?.data[0]).toMatchObject({
      title: "Resolved Album",
      imageUrl: "https://media.example/covers/album.jpg",
    });

    await act(async () => {
      window.dispatchEvent(new Event("library:changed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.getAlbum).toHaveBeenCalledTimes(1);
    expect(result?.data[0]).toMatchObject({
      id: "album/one",
      title: "Resolved Album",
      imageUrl: "https://media.example/covers/album.jpg",
      href: "/collection?type=album&id=album%2Fone",
      addedAt: savedAt,
    });
  });

  it("clears hydrated metadata when the authenticated account changes", async () => {
    const refreshedDetails: ApiAlbumDetails = {
      ...albumDetails,
      title: "New Account Album",
      cover: { url: "/covers/new-account.jpg", width: 640, height: 640 },
    };
    const sparseAlbum = { savedAt, album: { id: "album/one" } };
    vi.mocked(api.listSavedCollections)
      .mockResolvedValueOnce({ items: [sparseAlbum] })
      .mockResolvedValueOnce({ items: [sparseAlbum] });
    vi.mocked(api.getAlbum)
      .mockResolvedValueOnce(albumDetails)
      .mockResolvedValueOnce(refreshedDetails);

    await renderType("album");
    await act(async () => {
      window.dispatchEvent(new Event("auth:changed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.getAlbum).toHaveBeenCalledTimes(2);
    expect(result?.data[0]).toMatchObject({
      id: "album/one",
      title: "New Account Album",
      imageUrl: "https://media.example/covers/new-account.jpg",
    });
  });

  it("prunes hydrated metadata when a saved item is removed", async () => {
    const sparseAlbum = { savedAt, album: { id: "album/one" } };
    const updatedDetails: ApiAlbumDetails = {
      ...albumDetails,
      title: "Updated Album",
      cover: { url: "/covers/updated.jpg", width: 640, height: 640 },
    };
    vi.mocked(api.listSavedCollections)
      .mockResolvedValueOnce({ items: [sparseAlbum] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [sparseAlbum] });
    vi.mocked(api.getAlbum)
      .mockResolvedValueOnce(albumDetails)
      .mockResolvedValueOnce(updatedDetails);

    await renderType("album");
    await act(async () => {
      window.dispatchEvent(new Event("library:changed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result?.data).toEqual([]);

    await act(async () => {
      window.dispatchEvent(new Event("library:changed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.getAlbum).toHaveBeenCalledTimes(2);
    expect(result?.data[0]).toMatchObject({
      id: "album/one",
      title: "Updated Album",
      imageUrl: "https://media.example/covers/updated.jpg",
    });
  });

  it("shows all saved albums before a sparse album's detail lookup finishes", async () => {
    let resolveDetails: ((value: ApiAlbumDetails) => void) | undefined;
    const pendingDetails = new Promise<ApiAlbumDetails>((resolve) => {
      resolveDetails = resolve;
    });
    vi.mocked(api.listSavedCollections).mockResolvedValue({
      items: [
        {
          savedAt,
          album: {
            id: "album/complete",
            title: "Complete Album",
            cover: { url: "/covers/complete.jpg", width: 300, height: 300 },
          },
        },
        { savedAt, album: { id: "album/one", title: "Saved Summary" } },
      ],
    });
    vi.mocked(api.getAlbum).mockReturnValue(pendingDetails);

    await renderType("album");

    expect(api.getAlbum).toHaveBeenCalledWith("album/one");
    expect(result?.data.map((item) => item.id)).toEqual(["album/complete", "album/one"]);
    expect(result?.data[0]).toMatchObject({ title: "Complete Album", addedAt: savedAt });
    expect(result?.data[1]).toMatchObject({
      id: "album/one",
      title: "Saved Summary",
      href: "/collection?type=album&id=album%2Fone",
      addedAt: savedAt,
    });

    await act(async () => {
      resolveDetails?.(albumDetails);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result?.data).toHaveLength(2);
    expect(result?.data[0]?.title).toBe("Complete Album");
    expect(result?.data[1]).toMatchObject({
      id: "album/one",
      title: "Resolved Album",
      imageUrl: "https://media.example/covers/album.jpg",
      href: "/collection?type=album&id=album%2Fone",
      addedAt: savedAt,
    });
  });

  it("hydrates a sparse saved artist while preserving its id, link, and saved time", async () => {
    vi.mocked(api.listSavedCollections).mockResolvedValue({
      items: [{ savedAt, artist: { id: "artist/one" } }],
    });
    vi.mocked(api.getArtist).mockResolvedValue(artistDetails);

    await renderType("artist");

    expect(api.getArtist).toHaveBeenCalledWith("artist/one");
    expect(result?.data[0]).toMatchObject({
      id: "artist/one",
      title: "Resolved Artist",
      imageUrl: "https://media.example/covers/artist.jpg",
      href: "/artist?id=artist%2Fone",
      addedAt: savedAt,
    });
  });

  it("does not look up complete album or artist entries", async () => {
    vi.mocked(api.listSavedCollections).mockImplementation(async (type) =>
      type === "albums"
        ? {
            items: [
              {
                savedAt,
                album: {
                  id: "complete-album",
                  title: "Complete Album",
                  cover: { url: "/covers/complete-album.jpg", width: 300, height: 300 },
                },
              },
            ],
          }
        : {
            items: [
              {
                savedAt,
                artist: {
                  id: "complete-artist",
                  name: "Complete Artist",
                  cover: { url: "/covers/complete-artist.jpg", width: 300, height: 300 },
                },
              },
            ],
          },
    );

    await renderType("album");
    expect(result?.data[0]?.title).toBe("Complete Album");

    await renderType("artist");
    expect(result?.data[0]?.title).toBe("Complete Artist");
    expect(api.getAlbum).not.toHaveBeenCalled();
    expect(api.getArtist).not.toHaveBeenCalled();
  });

  it("keeps a failed album lookup's existing item while hydrating other saved albums", async () => {
    vi.mocked(api.listSavedCollections).mockResolvedValue({
      items: [
        {
          savedAt,
          album: { id: "album/fails", title: "Existing Album", year: 2001, trackCount: 7 },
        },
        { savedAt: "2026-10-16T12:00:00.000Z", album: { id: "album/one" } },
      ],
    });
    vi.mocked(api.getAlbum).mockImplementation(async (id) => {
      if (id === "album/fails") throw new Error("catalog unavailable");
      return albumDetails;
    });

    await renderType("album");

    expect(api.getAlbum).toHaveBeenCalledTimes(2);
    expect(result?.data).toHaveLength(2);
    expect(result?.data[0]).toMatchObject({
      id: "album/fails",
      title: "Existing Album",
      subtitle: "2001 • 7 tracks",
      href: "/collection?type=album&id=album%2Ffails",
      addedAt: savedAt,
    });
    expect(result?.data[1]).toMatchObject({
      id: "album/one",
      title: "Resolved Album",
      href: "/collection?type=album&id=album%2Fone",
      addedAt: "2026-10-16T12:00:00.000Z",
    });
  });

  it("keeps saved album metadata when a detail lookup resolves without an entity", async () => {
    vi.mocked(api.listSavedCollections).mockResolvedValue({
      items: [
        {
          savedAt,
          album: { id: "album/partial", title: "Saved Title", year: 1998, trackCount: 4 },
        },
      ],
    });
    vi.mocked(api.getAlbum).mockResolvedValue(undefined as unknown as ApiAlbumDetails);

    await renderType("album");

    expect(api.getAlbum).toHaveBeenCalledWith("album/partial");
    expect(result?.data[0]).toMatchObject({
      id: "album/partial",
      title: "Saved Title",
      subtitle: "1998 • 4 tracks",
      imageUrl: "",
      href: "/collection?type=album&id=album%2Fpartial",
      addedAt: savedAt,
    });
  });

  it("keeps playlist mapping on the saved-collection path without catalog lookups", async () => {
    vi.mocked(api.listSavedCollections).mockResolvedValue({
      items: [
        {
          savedAt,
          playlist: {
            id: "playlist/one",
            title: "Saved Playlist",
            author: "Playlist Author",
            trackCount: 12,
            cover: { url: "/covers/playlist.jpg", width: 300, height: 300 },
          },
        },
      ],
    });

    await renderType("playlist");

    expect(api.listSavedCollections).toHaveBeenCalledWith("playlists");
    expect(api.getAlbum).not.toHaveBeenCalled();
    expect(api.getArtist).not.toHaveBeenCalled();
    expect(result?.data[0]).toMatchObject({
      id: "playlist/one",
      title: "Saved Playlist",
      subtitle: "Playlist Author",
      imageUrl: "https://media.example/covers/playlist.jpg",
      href: "/collection?type=playlist&id=playlist%2Fone",
      addedAt: savedAt,
    });
  });

  it("does not let an older library refresh overwrite a newer result", async () => {
    let resolveInitial: ((value: { items: unknown[] }) => void) | undefined;
    const initialLoad = new Promise<{ items: unknown[] }>((resolve) => {
      resolveInitial = resolve;
    });
    vi.mocked(api.listSavedCollections)
      .mockReturnValueOnce(initialLoad)
      .mockResolvedValueOnce({
        items: [
          {
            savedAt,
            album: {
              id: "album/new",
              title: "New Album",
              cover: { url: "/covers/new.jpg", width: 300, height: 300 },
            },
          },
        ],
      });

    await renderType("album");
    await act(async () => {
      window.dispatchEvent(new Event("library:changed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result?.data[0]?.title).toBe("New Album");

    await act(async () => {
      resolveInitial?.({
        items: [
          {
            savedAt: "2026-10-15T12:00:00.000Z",
            album: {
              id: "album/old",
              title: "Old Album",
              cover: { url: "/covers/old.jpg", width: 300, height: 300 },
            },
          },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result?.data[0]?.title).toBe("New Album");
  });

  it("does not apply an old detail result after a library refresh replaces its saved item", async () => {
    let resolveOldDetails: ((value: ApiAlbumDetails) => void) | undefined;
    const oldDetails = new Promise<ApiAlbumDetails>((resolve) => {
      resolveOldDetails = resolve;
    });
    vi.mocked(api.listSavedCollections)
      .mockResolvedValueOnce({
        items: [{ savedAt, album: { id: "album/old", title: "Old Summary" } }],
      })
      .mockResolvedValueOnce({
        items: [
          {
            savedAt: "2026-10-18T12:00:00.000Z",
            album: {
              id: "album/current",
              title: "Current Album",
              cover: { url: "/covers/current.jpg", width: 300, height: 300 },
            },
          },
        ],
      });
    vi.mocked(api.getAlbum).mockReturnValue(oldDetails);

    await renderType("album");
    expect(api.getAlbum).toHaveBeenCalledWith("album/old");

    await act(async () => {
      window.dispatchEvent(new Event("library:changed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result?.data).toHaveLength(1);
    expect(result?.data[0]).toMatchObject({
      id: "album/current",
      title: "Current Album",
      href: "/collection?type=album&id=album%2Fcurrent",
      addedAt: "2026-10-18T12:00:00.000Z",
    });

    await act(async () => {
      resolveOldDetails?.({ ...albumDetails, id: "album/old", title: "Stale Hydration" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result?.data).toHaveLength(1);
    expect(result?.data[0]).toMatchObject({
      id: "album/current",
      title: "Current Album",
      href: "/collection?type=album&id=album%2Fcurrent",
      addedAt: "2026-10-18T12:00:00.000Z",
    });
  });

  it("ignores a pending collection response after switching item type", async () => {
    let resolveAlbums: ((value: { items: unknown[] }) => void) | undefined;
    const albumLoad = new Promise<{ items: unknown[] }>((resolve) => {
      resolveAlbums = resolve;
    });
    vi.mocked(api.listSavedCollections).mockImplementation((type) =>
      type === "albums"
        ? albumLoad
        : Promise.resolve({
            items: [
              {
                savedAt,
                artist: {
                  id: "artist/current",
                  name: "Current Artist",
                  cover: { url: "/covers/current.jpg", width: 300, height: 300 },
                },
              },
            ],
          }),
    );

    await renderType("album");
    await renderType("artist");
    expect(result?.data[0]?.title).toBe("Current Artist");

    await act(async () => {
      resolveAlbums?.({
        items: [
          {
            savedAt,
            album: {
              id: "album/late",
              title: "Late Album",
              cover: { url: "/covers/late.jpg", width: 300, height: 300 },
            },
          },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result?.data[0]?.title).toBe("Current Artist");
  });
});
