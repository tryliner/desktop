// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PopularTracksSection from "./PopularTracksSection";
import type { PopularItem } from "../hooks/usePopularTracks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/features/player", () => ({
  playerEngine: { playTrack: vi.fn(), addToQueue: vi.fn() },
}));
vi.mock("@/features/player/hooks/useSongMenuItems", () => ({
  useSongMenuItems: () => [],
}));
vi.mock("@/features/player/store/playerStore", () => ({
  usePlayerStore: (selector: (state: { trackDoubleClickBehavior: "play" }) => unknown) =>
    selector({ trackDoubleClickBehavior: "play" }),
}));
vi.mock("@/shared/ui", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/features/artist/ui/ArtistLink", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));
vi.mock("@/shared/ui/ScrollableRow", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("PopularTracksSection source attribution", () => {
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

  it("shows a provider icon on tracks without marking entity cards", async () => {
    const items: PopularItem[] = [
      {
        type: "track",
        playCount: 1,
        item: {
          id: "legacy-track-id",
          source: "soundcloud",
          externalUrl: "https://soundcloud.com/artist/song",
          title: "Song",
          artists: "Artist",
          coverUrl: "",
          durationMs: 180_000,
          playCount: 1,
        },
      },
      {
        type: "album",
        playCount: 1,
        item: {
          id: "album-id",
          title: "Album",
          artist: "Artist",
          coverUrl: "",
          totalTracks: 10,
          albumType: "album",
        },
      },
    ];

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PopularTracksSection title="Jump Back In" items={items} />
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-source-badge="soundcloud"]')).toHaveLength(1);
  });
});
