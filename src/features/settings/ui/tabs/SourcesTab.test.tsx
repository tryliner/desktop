// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AVAILABLE_SEARCH_SOURCES,
  useSearchSourceStore,
} from "@/features/search/store/searchSourceStore";
import { ToastProvider } from "@/shared/ui";
import { SourcesTab } from "./SourcesTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SourcesTab", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useSearchSourceStore.setState({
      enabledSources: [...AVAILABLE_SEARCH_SOURCES],
      selectedSources: [...AVAILABLE_SEARCH_SOURCES],
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  async function renderTab(searchQuery?: string): Promise<void> {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <SourcesTab searchQuery={searchQuery} />
          </ToastProvider>
        </MemoryRouter>,
      );
    });
  }

  function toggle(name: string): HTMLButtonElement {
    return container.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
  }

  it("shows both working providers enabled by default", async () => {
    await renderTab();

    expect(toggle("Enable YouTube Music").getAttribute("aria-pressed")).toBe("true");
    expect(toggle("Enable SoundCloud").getAttribute("aria-pressed")).toBe("true");
  });

  it("updates source preferences and disables the final enabled toggle", async () => {
    await renderTab();
    await act(async () => toggle("Enable YouTube Music").click());

    expect(useSearchSourceStore.getState().enabledSources).toEqual(["soundcloud"]);
    expect(toggle("Enable SoundCloud").disabled).toBe(true);
  });

  it("filters provider rows using the settings query", async () => {
    await renderTab("SoundCloud");

    expect(container.textContent).toContain("SoundCloud");
    expect(container.textContent).not.toContain("YouTube Music");
    expect(container.textContent).not.toContain("More sources coming soon");
  });

  it("announces the Coming soon providers without changing preferences", async () => {
    await renderTab();
    const comingSoon = container.querySelector('button[aria-label="More sources coming soon"]') as HTMLButtonElement;
    await act(async () => comingSoon.click());

    expect(document.body.textContent).toContain(
      "Spotify, Apple Music, TIDAL, and Deezer are coming soon.",
    );
    expect(useSearchSourceStore.getState().enabledSources).toEqual(["youtube", "soundcloud"]);
  });
});
