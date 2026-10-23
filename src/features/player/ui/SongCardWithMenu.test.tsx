// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SongCardWithMenu from "./SongCardWithMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  addToQueue: vi.fn(),
  trackDoubleClickBehavior: "play" as "play" | "queue",
}));

vi.mock("@/features/artist", () => ({ ArtistLink: () => null }));
vi.mock("../hooks/useSongMenuItems", () => ({ useSongMenuItems: () => [] }));
vi.mock("../engine/playerEngine", () => ({
  playerEngine: { addToQueue: mocks.addToQueue },
}));
vi.mock("../store/playerStore", () => ({
  usePlayerStore: (
    selector: (state: { trackDoubleClickBehavior: "play" | "queue" }) => unknown,
  ) => selector({ trackDoubleClickBehavior: mocks.trackDoubleClickBehavior }),
}));
vi.mock("@/shared/ui", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("SongCardWithMenu source attribution", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.addToQueue.mockReset();
    mocks.trackDoubleClickBehavior = "play";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows provider attribution for songs but not entity cards", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <>
            <SongCardWithMenu
              id="spotify-track-id"
              title="Song"
              artists="Artist"
              coverUrl=""
              source="youtube"
              searchType="track"
            />
            <SongCardWithMenu
              id="album-id"
              title="Album"
              artists="Artist"
              coverUrl=""
              source="youtube"
              searchType="album"
            />
          </>
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-source-badge="youtube"]')).toHaveLength(1);
  });

  it("preserves provider metadata when double-clicking a song into the queue", async () => {
    mocks.trackDoubleClickBehavior = "queue";

    await act(async () => {
      root.render(
        <MemoryRouter>
          <SongCardWithMenu
            id="legacy-track-id"
            title="Song"
            artists="Artist"
            coverUrl=""
            source="soundcloud"
            externalUrl="https://soundcloud.com/artist/song"
            searchType="track"
            onPlay={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    const card = container.querySelector('[role="button"]');
    expect(card).not.toBeNull();
    await act(async () => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    });

    expect(mocks.addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "soundcloud",
        externalUrl: "https://soundcloud.com/artist/song",
      }),
    );
  });
});
