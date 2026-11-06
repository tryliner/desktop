// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { usePlaylistVisibility } from "./usePlaylistVisibility";
import { applyPlaylistVisibility, notifyLibraryChanged } from "./usePlaylists";
import { api, ApiError } from "@/shared/api";
import { showToast } from "@/shared/ui";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/api", () => {
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly code?: string,
      public readonly requestId?: string,
    ) {
      super(message);
    }
  }
  return { ApiError, api: { setPlaylistVisibility: vi.fn() } };
});

vi.mock("./usePlaylists", () => ({
  applyPlaylistVisibility: vi.fn(),
  notifyLibraryChanged: vi.fn(),
}));

vi.mock("@/shared/ui", () => ({ showToast: vi.fn() }));

vi.mock("@/languages", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ID = "7a1f0e7e-3b7c-4c55-9a43-1f1c4ab8e0de";
const LINK = `https://link.tryliner.fun/playlist?id=${ID}`;

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe("usePlaylistVisibility", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hook: ReturnType<typeof usePlaylistVisibility>;
  const writeText = vi.fn().mockResolvedValue(undefined);

  function Probe() {
    hook = usePlaylistVisibility();
    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText } });
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(<Probe />));
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("copies the link of a public playlist", () => {
    hook.sharePlaylist(ID, true, "Mine");
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(showToast).toHaveBeenCalledWith("common.link_copied", "checkmark", {
      description: "Mine",
    });
  });

  it("copies nothing for a private playlist and offers to make it public", async () => {
    (api.setPlaylistVisibility as any).mockResolvedValue({ isPublic: true });
    hook.sharePlaylist(ID, false, "Mine");
    expect(writeText).not.toHaveBeenCalled();
    const [message, variant, options] = (showToast as any).mock.calls[0];
    expect(message).toBe("playlist.share_private");
    expect(variant).toBe("info");
    expect(options.action.label).toBe("playlist.make_public");

    act(() => options.action.onClick());
    await flush();
    expect(api.setPlaylistVisibility).toHaveBeenCalledWith(ID, true);
    expect(writeText).toHaveBeenCalledWith(LINK);
    // only the link toast, the change itself is quiet here
    expect(
      (showToast as any).mock.calls.map((call: unknown[]) => call[0]),
    ).toEqual(["playlist.share_private", "common.link_copied"]);
  });

  it("shows the change at once and keeps what the server answers", async () => {
    (api.setPlaylistVisibility as any).mockResolvedValue({ isPublic: true });
    let done: boolean | undefined;
    await act(async () => {
      done = await hook.changeVisibility(ID, true);
    });
    expect(done).toBe(true);
    expect((applyPlaylistVisibility as any).mock.calls).toEqual([
      [ID, true],
      [ID, true],
    ]);
    expect(notifyLibraryChanged).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("playlist.made_public", "checkmark");
  });

  it("puts the visibility back and says so when the server refuses", async () => {
    (api.setPlaylistVisibility as any).mockRejectedValue(
      new ApiError(404, "Playlist was not found.", "PLAYLIST_NOT_FOUND", "r1"),
    );
    let done: boolean | undefined;
    await act(async () => {
      done = await hook.changeVisibility(ID, false);
    });
    expect(done).toBe(false);
    expect((applyPlaylistVisibility as any).mock.calls).toEqual([
      [ID, false],
      [ID, true],
    ]);
    expect(notifyLibraryChanged).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "playlist.visibility_failed",
      "error",
      {
        requestId: "r1",
        errorCode: "PLAYLIST_NOT_FOUND",
      },
    );
  });
});
