// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SongCard from "./SongCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/features/artist", () => ({ ArtistLink: () => null }));

describe("SongCard source attribution", () => {
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

  it("places a compact provider icon beside the artist instead of in trailing controls", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <SongCard
            title="Night Drive"
            artists="Artist"
            artistsClickable={false}
            coverUrl=""
            icon={<span />}
            source="soundcloud"
            trailingControl={<span data-testid="trailing-control">extra</span>}
          />
        </MemoryRouter>,
      );
    });

    const badge = container.querySelector('[data-source-badge="soundcloud"]') as HTMLElement;
    const artistLine = container.querySelector("p") as HTMLParagraphElement;
    const trailingControl = container.querySelector('[data-testid="trailing-control"]') as HTMLElement;

    expect(artistLine.contains(badge)).toBe(true);
    expect(trailingControl.contains(badge)).toBe(false);
  });

  it("infers provider icons only for recognizable playable song IDs", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <>
            <SongCard
              id="dQw4w9WgXcQ"
              title="YouTube song"
              artists="Artist"
              artistsClickable={false}
              coverUrl=""
              icon={<span />}
              showSource
            />
            <SongCard
              id="sc:1099045843"
              title="SoundCloud song"
              artists="Artist"
              artistsClickable={false}
              coverUrl=""
              icon={<span />}
              showSource
            />
            <SongCard
              id="local-file-1"
              title="Unknown song"
              artists="Artist"
              artistsClickable={false}
              coverUrl=""
              icon={<span />}
              showSource
            />
          </>
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-source-badge="youtube"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-source-badge="soundcloud"]')).toHaveLength(1);
    expect(container.querySelectorAll("[data-source-badge]")).toHaveLength(2);
  });
});
