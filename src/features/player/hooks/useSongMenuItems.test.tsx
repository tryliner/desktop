// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useSongMenuItems, SongMenuContext } from "./useSongMenuItems";
import { showToast } from "@/shared/ui";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/features/library", () => ({
  usePlaylistsList: () => ({ data: { playlists: [] } }),
  useLikeTrack: () => ({ mutate: vi.fn() }),
  useUnlikeTrack: () => ({ mutate: vi.fn() }),
  useIsTrackLiked: () => false,
  useModalStore: {
    getState: () => ({
      openAddToPlaylist: vi.fn(),
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
      "https://link.tryliner.fun/track?id=track-123"
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
      "https://link.tryliner.fun/track?id=track-456"
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
      "https://link.tryliner.fun/album?id=album-789"
    );
  });

  it("adds a remove-from-queue entry only for queue rows", () => {
    const onRemoveFromQueue = vi.fn();
    const entry = renderHookHelper({ id: "t1", title: "Demo", artists: "Me", coverUrl: "", onRemoveFromQueue })().find(
      (item) => item.id === "remove-from-queue",
    );
    expect(entry?.label).toBe("common.remove_from_queue");
    expect(entry?.danger).toBe(true);
    act(() => entry?.onClick?.());
    expect(onRemoveFromQueue).toHaveBeenCalledTimes(1);

    const elsewhere = renderHookHelper({ id: "t1", title: "Demo", artists: "Me", coverUrl: "" })();
    expect(elsewhere.map((item) => item.id)).not.toContain("remove-from-queue");
  });
});
