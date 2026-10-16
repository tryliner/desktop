import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { I18nProvider } from "@/languages";
import LibraryPage from "./LibraryPage";
import { useDownloadedTracks } from "../hooks";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks")>()),
  usePlaylistsList: () => ({ data: { playlists: [] }, error: null, isLoading: false }),
  useExternalItems: () => ({ data: [] }),
  useLikedTrackCount: () => ({ data: 4, isLoading: false }),
  useDownloadedTracks: vi.fn(),
}));

const sample = (id: string) => ({ id, title: id, artists: "A", coverUrl: "", durationMs: 1, playCount: 0 });

let currentPath = "";
function LocationProbe() {
  const location = useLocation();
  currentPath = location.pathname + location.search;
  return null;
}

async function renderLibrary() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/library"]}>
        <I18nProvider>
          <LibraryPage />
          <LocationProbe />
        </I18nProvider>
      </MemoryRouter>,
    );
  });
  return { host, root };
}

describe("LibraryPage downloaded music card", () => {
  let mounted: { host: HTMLElement; root: Root } | null = null;

  beforeEach(() => {
    currentPath = "";
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    if (mounted) {
      const { host, root } = mounted;
      act(() => root.unmount());
      host.remove();
      mounted = null;
    }
    vi.unstubAllGlobals();
  });

  it("shows downloaded music next to liked songs and opens it", async () => {
    vi.mocked(useDownloadedTracks).mockReturnValue({
      data: [sample("a"), sample("b")],
      isLoading: false,
      refresh: async () => {},
    });
    mounted = await renderLibrary();

    const text = mounted.host.textContent ?? "";
    expect(text).toMatch(/Liked songs|Liked Songs|Likes/);
    expect(text).toContain("Downloaded music");
    expect(text.indexOf("Downloaded music")).toBeGreaterThan(text.search(/Liked songs|Liked Songs|Likes/));

    const card = Array.from(mounted.host.querySelectorAll("span, h3")).find(
      (el) => el.textContent === "Downloaded music",
    );
    expect(card).toBeDefined();
    await act(async () => {
      (card!.closest("div[class*='cursor-pointer']") as HTMLElement).click();
    });
    expect(currentPath).toBe("/library/playlist?id=downloads");
  });

  it("hides the card when nothing is downloaded", async () => {
    vi.mocked(useDownloadedTracks).mockReturnValue({ data: [], isLoading: false, refresh: async () => {} });
    mounted = await renderLibrary();
    expect(mounted.host.textContent).not.toContain("Downloaded music");
  });
});
