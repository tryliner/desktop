// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useSongMenuItems, SongMenuContext } from "./useSongMenuItems";
import { showToast } from "@/shared/ui";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const library = vi.hoisted(() => ({
  playlists: [] as { id: string; title: string }[],
  recent: [] as string[],
  addAndReport: vi.fn(),
  openAddToPlaylist: vi.fn(),
  openCreatePlaylist: vi.fn(),
}));

vi.mock("@/features/library", () => ({
  usePlaylistsList: () => ({ data: { playlists: library.playlists } }),
  useToggleTrackLike: () => vi.fn(),
  useIsTrackLiked: () => false,
  useRecentPlaylists: () => library.recent,
  sortByRecent: <T extends { id: string }>(list: T[], recent: string[]) => {
    const rank = new Map(recent.map((id, i) => [id, i]));
    return [...list].sort(
      (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
    );
  },
  addAndReport: library.addAndReport,
  useModalStore: {
    getState: () => ({
      openAddToPlaylist: library.openAddToPlaylist,
      openCreatePlaylist: library.openCreatePlaylist,
      openRemoveFromPlaylist: vi.fn(),
      openAddToLibrary: vi.fn(),
    }),
  },
}));

vi.mock("@/languages", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "common.start_radio": "Start station",
        "common.play_next": "Play next",
        "common.add_to_queue": "Add to queue",
        "common.like": "Like",
        "common.unlike": "Unlike",
        "common.add_to_playlist": "Add to playlist",
        "common.remove_from_playlist": "Remove from playlist",
        "common.add_to_library": "Add to library",
        "common.share": "Share",
        "common.link_copied": "Link copied",
      };
      return dict[key] || key;
    },
  }),
}));

vi.mock("@/shared/ui", () => ({
  showToast: vi.fn(),
}));

describe("useSongMenuItems", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    library.playlists = [];
    library.recent = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  function renderHookHelper(ctx: SongMenuContext) {
    let result: DropdownMenuItem[] = [];
    function TestComponent() {
      result = useSongMenuItems(ctx);
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
    return () => result;
  }

  it("includes share item for a standard track and copies track link to clipboard", () => {
    const getResult = renderHookHelper({
      id: "track-123",
      title: "Tarde o temprano",
      artists: "Nsqk",
      coverUrl: "https://covers.tryliner.fun/test.jpg",
    });

    const items = getResult();
    const shareItem = items.find((item) => item.id === "share");
    expect(shareItem).toBeDefined();
    expect(shareItem?.label).toBe("Share");

    act(() => {
      shareItem?.onClick?.();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://link.tryliner.fun/track?id=track-123",
    );
    expect(showToast).toHaveBeenCalledWith("Link copied", "checkmark", {
      description: "Tarde o temprano — Nsqk",
    });
  });

  it("includes share item when inside a playlist with remove-from-playlist option", () => {
    const getResult = renderHookHelper({
      id: "track-456",
      title: "SANGRE !",
      artists: "Nsqk",
      coverUrl: "https://covers.tryliner.fun/test2.jpg",
      playlistId: "playlist-1",
      playlistItemId: "item-1",
    });

    const items = getResult();
    const ids = items.map((i) => i.id);
    expect(ids).toContain("share");
    expect(ids).toContain("remove-from-playlist");

    const shareItem = items.find((item) => item.id === "share");
    act(() => {
      shareItem?.onClick?.();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://link.tryliner.fun/track?id=track-456",
    );
  });

  it("includes share item for non-track entities (e.g. album)", () => {
    const getResult = renderHookHelper({
      id: "album-789",
      title: "ROY",
      artists: "Nsqk",
      coverUrl: "https://covers.tryliner.fun/album.jpg",
      searchType: "album",
    });

    const items = getResult();
    const ids = items.map((i) => i.id);
    expect(ids).toContain("add-to-library");
    expect(ids).toContain("share");

    const shareItem = items.find((item) => item.id === "share");
    act(() => {
      shareItem?.onClick?.();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://link.tryliner.fun/album?id=album-789",
    );
  });

  it("adds a remove-from-queue entry only for queue rows", () => {
    const onRemoveFromQueue = vi.fn();
    const entry = renderHookHelper({
      id: "t1",
      title: "Demo",
      artists: "Me",
      coverUrl: "",
      onRemoveFromQueue,
    })().find((item) => item.id === "remove-from-queue");
    expect(entry?.label).toBe("common.remove_from_queue");
    expect(entry?.danger).toBe(true);
    act(() => entry?.onClick?.());
    expect(onRemoveFromQueue).toHaveBeenCalledTimes(1);

    const elsewhere = renderHookHelper({
      id: "t1",
      title: "Demo",
      artists: "Me",
      coverUrl: "",
    })();
    expect(elsewhere.map((item) => item.id)).not.toContain("remove-from-queue");
  });

  it("opens the picker directly when there are no playlists yet", () => {
    const item = renderHookHelper({
      id: "t1",
      title: "Demo",
      artists: "Me",
      coverUrl: "",
    })().find((entry) => entry.id === "add-to-playlist");
    expect(item?.children).toBeUndefined();
    act(() => item?.onClick?.());
    expect(library.openAddToPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", title: "Demo" }),
    );
  });

  it("lists recent playlists first in the add-to-playlist submenu", () => {
    library.playlists = [
      { id: "a", title: "Alpha" },
      { id: "b", title: "Beta" },
      { id: "c", title: "Gamma" },
    ];
    library.recent = ["c"];
    const item = renderHookHelper({
      id: "t1",
      title: "Demo",
      artists: "Me",
      coverUrl: "",
    })().find((entry) => entry.id === "add-to-playlist");
    const labels = item?.children?.map((child) => child.label);
    expect(labels?.slice(0, 3)).toEqual(["Gamma", "Alpha", "Beta"]);
    expect(item?.children?.map((child) => child.id).slice(-2)).toEqual([
      "quick-add-new",
      "quick-add-more",
    ]);

    act(() => item?.children?.[0].onClick?.());
    expect(library.addAndReport).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "t1" })],
      [{ id: "c", title: "Gamma" }],
      expect.any(Function),
    );
  });

  it("offers add-to-playlist inside a playlist, without that playlist", () => {
    library.playlists = [
      { id: "playlist-1", title: "Current" },
      { id: "other", title: "Other" },
    ];
    const items = renderHookHelper({
      id: "track-456",
      title: "SANGRE !",
      artists: "Nsqk",
      coverUrl: "",
      playlistId: "playlist-1",
      playlistItemId: "item-1",
    })();
    const add = items.find((entry) => entry.id === "add-to-playlist");
    expect(add).toBeDefined();
    expect(add?.children?.map((child) => child.label)).not.toContain("Current");
    expect(add?.children?.map((child) => child.label)).toContain("Other");
  });

  it("drops add-to-playlist for files on this device", () => {
    library.playlists = [{ id: "a", title: "Alpha" }];
    const ids = renderHookHelper({
      id: "local:abc",
      title: "Demo",
      artists: "Me",
      coverUrl: "",
    })().map((entry) => entry.id);
    expect(ids).not.toContain("add-to-playlist");
  });
});
