import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { toClientTrack } from "./track";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("toClientTrack", () => {
  it("maps an api track", () => {
    const c1 = toClientTrack({
      id: "4IbRT6Vfl_U",
      title: "One Dance",
      artists: [{ id: "UCECJhbsxgI5hWFz8EU0TY-g", name: "Drake" }],
      durationMs: 227000,
      cover: { url: "https://i.ytimg.com/a.jpg", width: null, height: null },
    });
    expect(c1.artistId).toBe("UCECJhbsxgI5hWFz8EU0TY-g");
    expect(c1.artistList).toEqual([
      { id: "UCECJhbsxgI5hWFz8EU0TY-g", name: "Drake" },
    ]);
    expect(c1.artists).toBe("Drake");
    expect(c1.coverUrl).toBe("https://i.ytimg.com/a.jpg");
    expect(c1.durationMs).toBe(227000);
  });

  it("renders unknown artist ids and durations gracefully", () => {
    const t = toClientTrack({
      id: "sc:123",
      title: "Test 2",
      artists: [
        { id: null, name: "Artist A" },
        { id: "idB", name: "Artist B" },
      ],
      durationMs: null,
    });
    expect(t.artists).toBe("Artist A, Artist B");
    expect(t.artistId).toBe("idB");
    expect(t.artistList).toEqual([
      { id: "", name: "Artist A" },
      { id: "idB", name: "Artist B" },
    ]);
    expect(t.durationMs).toBe(0);
    expect(t.coverUrl).toBe("");
  });

  it("maps album metadata when present", () => {
    const t = toClientTrack({
      id: "track1abcde",
      title: "Come Together",
      artists: [{ id: null, name: "The Beatles" }],
      durationMs: null,
      album: { id: "alb1", title: "Abbey Road" },
    });
    expect(t.album).toEqual({ id: "alb1", title: "Abbey Road" });
  });

  it("renders ArtistLink and tests click behavior", async () => {
    const { createRoot } = await import("react-dom/client");
    const { default: ArtistLink } =
      await import("../../features/artist/ui/ArtistLink");
    const { MemoryRouter } = await import("react-router-dom");
    const { act } = await import("react");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let currentLocation = "";
    function LocationProbe() {
      const location = (require("react-router-dom") as any).useLocation();
      currentLocation = location.pathname + location.search;
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/"] },
          React.createElement(LocationProbe, null),
          React.createElement(ArtistLink, {
            name: "Drake",
            artistId: "UCECJhbsxgI5hWFz8EU0TY-g",
            artistList: [{ id: "UCECJhbsxgI5hWFz8EU0TY-g", name: "Drake" }],
          }),
        ),
      );
    });

    const button = container.querySelector("[role='button']") as HTMLElement;
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("Drake");
    expect(currentLocation).toBe("/");

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(currentLocation).toBe("/artist?id=UCECJhbsxgI5hWFz8EU0TY-g");

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  async function renderArtistLink(name: string) {
    const { createRoot } = await import("react-dom/client");
    const { default: ArtistLink } =
      await import("../../features/artist/ui/ArtistLink");
    const { MemoryRouter } = await import("react-router-dom");
    const { act } = await import("react");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const location = { current: "" };
    function LocationProbe() {
      const current = (require("react-router-dom") as any).useLocation();
      location.current = current.pathname + current.search;
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/"] },
          React.createElement(LocationProbe, null),
          React.createElement(ArtistLink, { name }),
        ),
      );
    });

    const click = async () => {
      const button = container.querySelector("[role='button']") as HTMLElement;
      await act(async () => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    };
    const cleanup = async () => {
      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
    };
    return { container, location, click, cleanup };
  }

  it("resolves the artist by name when artistId is absent", async () => {
    const { api } = await import("./api");
    const search = vi.spyOn(api, "search").mockResolvedValue({
      items: [
        { type: "artist", id: "UCtribute", name: "The Beatles Tribute" },
        { type: "artist", id: "UCbeatles", name: "the beatles" },
      ],
    });

    const view = await renderArtistLink("The Beatles");
    expect(view.container.querySelector("[role='button']")?.textContent).toBe(
      "The Beatles",
    );

    await view.click();

    expect(search).toHaveBeenCalledWith("The Beatles", "artist");
    expect(view.location.current).toBe("/artist?id=UCbeatles");
    await view.cleanup();
    search.mockRestore();
  });

  it("falls back to plain text when no artist matches the name", async () => {
    const { api } = await import("./api");
    const search = vi
      .spyOn(api, "search")
      .mockResolvedValue({ items: [] });

    const view = await renderArtistLink("Nobody Known");
    await view.click();

    expect(view.location.current).toBe("/");
    expect(view.container.querySelector("[role='button']")).toBeNull();
    expect(view.container.textContent).toBe("Nobody Known");
    await view.cleanup();
    search.mockRestore();
  });
});
