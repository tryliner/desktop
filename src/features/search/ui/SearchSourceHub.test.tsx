// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/shared/ui";
import { AVAILABLE_SEARCH_SOURCES, useSearchSourceStore } from "../store/searchSourceStore";
import { SearchSourceHub } from "./SearchSourceHub";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SearchSourceHub", () => {
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

  async function renderHub(onParentClick = vi.fn()): Promise<ReturnType<typeof vi.fn>> {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <div onClick={onParentClick}>
              <SearchSourceHub />
            </div>
          </ToastProvider>
        </MemoryRouter>,
      );
    });
    return onParentClick;
  }

  function trigger(): HTMLButtonElement {
    return container.querySelector('button[aria-label="Sources"]') as HTMLButtonElement;
  }

  async function openHub(): Promise<void> {
    await act(async () => trigger().click());
  }

  it("renders a neutral accessible trigger when every enabled source is selected", async () => {
    await renderHub();

    expect(trigger().dataset.sourceState).toBe("all");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().className).toContain("text-text-secondary");
  });

  it("uses provider color states for a single selected source", async () => {
    useSearchSourceStore.setState({ selectedSources: ["youtube"] });
    await renderHub();
    expect(trigger().dataset.sourceState).toBe("youtube");
    expect(trigger().className).toContain("text-[#ff0033]");

    await act(async () => {
      useSearchSourceStore.setState({ selectedSources: ["soundcloud"] });
    });
    expect(trigger().dataset.sourceState).toBe("soundcloud");
    expect(trigger().className).toContain("text-[#ff5500]");
  });

  it("keeps the popover open while provider selections change", async () => {
    await renderHub();
    await openHub();

    const youtube = document.body.querySelector('[role="menuitemcheckbox"][aria-label="YouTube Music"]') as HTMLButtonElement;
    await act(async () => youtube.click());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(document.body.querySelector("[data-dropdown-menu]")).not.toBeNull();
    expect(useSearchSourceStore.getState().selectedSources).toEqual(["soundcloud"]);
  });

  it("does not deselect the final selected source", async () => {
    useSearchSourceStore.setState({ selectedSources: ["youtube"] });
    await renderHub();
    await openHub();

    const youtube = document.body.querySelector('[role="menuitemcheckbox"][aria-label="YouTube Music"]') as HTMLButtonElement;
    await act(async () => youtube.click());

    expect(useSearchSourceStore.getState().selectedSources).toEqual(["youtube"]);
  });

  it("hides providers disabled in Settings", async () => {
    useSearchSourceStore.setState({
      enabledSources: ["soundcloud"],
      selectedSources: ["soundcloud"],
    });
    await renderHub();
    await openHub();

    expect(document.body.querySelector('[aria-label="YouTube Music"]')).toBeNull();
    expect(document.body.querySelector('[aria-label="SoundCloud"]')).not.toBeNull();
  });

  it("separates working providers from the Coming soon action", async () => {
    await renderHub();
    await openHub();

    const separator = document.body.querySelector('[role="separator"]');
    const comingSoon = document.body.querySelector('[aria-label="More sources coming soon"]');
    expect(separator?.nextElementSibling).toBe(comingSoon);
  });

  it("closes and announces the Coming soon providers without changing source state", async () => {
    await renderHub();
    await openHub();

    const comingSoon = document.body.querySelector('[aria-label="More sources coming soon"]') as HTMLButtonElement;
    await act(async () => comingSoon.click());

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.body.textContent).toContain(
      "Spotify, Apple Music, TIDAL, and Deezer are coming soon.",
    );
    expect(useSearchSourceStore.getState().selectedSources).toEqual(["youtube", "soundcloud"]);
  });

  it("does not bubble trigger or option activation to the filter row", async () => {
    const onParentClick = await renderHub();
    await openHub();
    const soundcloud = document.body.querySelector('[role="menuitemcheckbox"][aria-label="SoundCloud"]') as HTMLButtonElement;
    await act(async () => soundcloud.click());

    expect(onParentClick).not.toHaveBeenCalled();
  });
});
