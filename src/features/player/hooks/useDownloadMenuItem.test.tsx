// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { useDownloadMenuItem } from "./useDownloadMenuItem";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

const state = vi.hoisted(() => ({
  download: {
    state: null as string | null,
    pinned: false,
    pinnedDirectly: false,
  },
  removeTrackDownloads: vi.fn(),
  downloadTracks: vi.fn(),
}));

vi.mock("@/features/library", () => ({
  canDownloadHere: () => true,
  useTrackDownloadState: () => ({ ...state.download, progress: null }),
  removeTrackDownloads: state.removeTrackDownloads,
  downloadTracks: state.downloadTracks,
}));

vi.mock("@/languages", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const track = { id: "t1", title: "Song", artists: "Artist", coverUrl: "" };

describe("useDownloadMenuItem", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(): DropdownMenuItem | null {
    let item: DropdownMenuItem | null = null;
    function Probe() {
      item = useDownloadMenuItem(track);
      return null;
    }
    act(() => root.render(<Probe />));
    return item;
  }

  it("offers a download for a song that isn't saved", () => {
    state.download = { state: null, pinned: false, pinnedDirectly: false };
    const item = render();
    expect(item?.id).toBe("download-track");
    act(() => void item?.onClick());
    expect(state.downloadTracks).toHaveBeenCalled();
  });

  it("offers removal for a song pinned on its own", () => {
    state.download = {
      state: "downloaded",
      pinned: true,
      pinnedDirectly: true,
    };
    expect(render()?.id).toBe("remove-download");
  });

  it("offers nothing for a song kept by a downloaded playlist", () => {
    state.download = {
      state: "downloaded",
      pinned: true,
      pinnedDirectly: false,
    };
    expect(render()).toBeNull();
  });
});
