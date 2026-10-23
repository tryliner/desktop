// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/shared/ui";
import { AVAILABLE_SEARCH_SOURCES, useSearchSourceStore } from "../store/searchSourceStore";
import { SearchFilterBar } from "./SearchFilterBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SearchFilterBar", () => {
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

  it("places Sources immediately after the content filters", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <SearchFilterBar activeFilter="all" onChange={vi.fn()} />
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    const controls = Array.from(container.querySelectorAll('[role="toolbar"] button'));
    expect(controls.map((control) => control.getAttribute("aria-label"))).toEqual([
      "All",
      "Songs",
      "Artists",
      "Albums",
      "Playlists",
      "Sources",
    ]);
  });
});
