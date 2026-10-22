// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useSongMenuItems, type SongMenuContext } from "./useSongMenuItems";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/features/library", () => ({
  usePlaylistsList: () => ({ data: { playlists: [] } }),
  useLikeTrack: () => ({ mutate: vi.fn() }),
  useUnlikeTrack: () => ({ mutate: vi.fn() }),
  useIsTrackLiked: () => false,
  useModalStore: { getState: () => ({}) },
}));
vi.mock("@/languages", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/shared/ui", () => ({ showToast: vi.fn() }));

describe("useSongMenuItems — play queue", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function menuFor(ctx: SongMenuContext): DropdownMenuItem[] {
    let items: DropdownMenuItem[] = [];
    function Probe() {
      items = useSongMenuItems(ctx);
      return null;
    }
    act(() => root.render(<Probe />));
    return items;
  }

  it("adds a remove-from-queue entry only for queue rows", () => {
    const onRemoveFromQueue = vi.fn();
    const entry = menuFor({ id: "t1", title: "Demo", artists: "Me", coverUrl: "", onRemoveFromQueue }).find(
      (item) => item.id === "remove-from-queue",
    );
    expect(entry?.label).toBe("common.remove_from_queue");
    expect(entry?.danger).toBe(true);
    act(() => entry?.onClick?.());
    expect(onRemoveFromQueue).toHaveBeenCalledTimes(1);

    const elsewhere = menuFor({ id: "t1", title: "Demo", artists: "Me", coverUrl: "" });
    expect(elsewhere.map((item) => item.id)).not.toContain("remove-from-queue");
  });
});
