// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchResultsPanel } from "./SearchResultsPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SearchResultsPanel", () => {
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

  it.each([
    ["empty results", null],
    ["populated results", <div key="result">Result row</div>],
  ])("keeps a partial-provider warning visible with %s", async (_label, content) => {
    await act(async () => {
      root.render(
        <SearchResultsPanel partialWarning="SoundCloud is unavailable">
          {content}
        </SearchResultsPanel>,
      );
    });

    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "SoundCloud is unavailable",
    );
  });
});
