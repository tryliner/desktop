// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchResultKey, SearchResultsList } from "./SearchResultsList";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 64,
    getVirtualItems: () => [{ index: 0, key: "row-0", start: 0 }],
    measureElement: vi.fn(),
  }),
}));

vi.mock("@/features/player/ui/SongCardWithMenu", () => ({
  default: ({
    title,
    artists,
    className,
    source,
    externalUrl,
  }: {
    title: string;
    artists: string;
    className?: string;
    source?: string;
    externalUrl?: string;
  }) => (
    <div
      data-testid="song-card"
      data-class-name={className}
      data-source={source}
      data-external-url={externalUrl}
    >
      {title} — {artists}
    </div>
  ),
}));

describe("SearchResultsList source metadata", () => {
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

  it("uses source and result type to distinguish provider IDs", () => {
    expect(searchResultKey({ id: "7", source: "youtube", _type: "track" }, 0)).not.toBe(
      searchResultKey({ id: "7", source: "soundcloud", _type: "track" }, 1),
    );
  });

  it("passes provider attribution to the song card for artist-line placement", async () => {
    await act(async () => {
      root.render(
        <SearchResultsList
          items={[{
            id: "sc:7",
            _type: "track",
            title: "Night Drive",
            artists: "Artist",
            source: "soundcloud",
            externalUrl: "https://soundcloud.com/u/night-drive",
          }]}
          isArtistSearchFilter={false}
          isPlaylistSearchFilter={false}
          onPlayFromSearch={vi.fn()}
          onNavigateItem={vi.fn()}
        />,
      );
    });

    const card = container.querySelector('[data-testid="song-card"]') as HTMLElement;
    expect(card.dataset.source).toBe("soundcloud");
    expect(card.dataset.externalUrl).toBe("https://soundcloud.com/u/night-drive");
    expect(card.dataset.className ?? "").not.toContain("pr-[140px]");
  });
});
