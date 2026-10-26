import { describe, it, expect, vi } from "vitest";
import { baseOptions, mount, press } from "./useGlobalShortcuts.testSetup";

describe("useGlobalShortcuts Escape priority", () => {
  it("closes Search first when Search, the right panel and Fullscreen are all open", () => {
    const closeSearch = vi.fn();
    const closeRightPanel = vi.fn();
    const closeFullscreen = vi.fn();
    mount(
      baseOptions({
        searchOpen: true,
        closeSearch,
        rightPanelOpen: true,
        closeRightPanel,
        fullscreenOpen: true,
        closeFullscreen,
      }),
    );
    press("Escape");
    expect(closeSearch).toHaveBeenCalledTimes(1);
    expect(closeRightPanel).not.toHaveBeenCalled();
    expect(closeFullscreen).not.toHaveBeenCalled();
  });

  it("closes the right panel next once Search is already closed", () => {
    const closeRightPanel = vi.fn();
    const closeFullscreen = vi.fn();
    mount(
      baseOptions({
        searchOpen: false,
        rightPanelOpen: true,
        closeRightPanel,
        fullscreenOpen: true,
        closeFullscreen,
      }),
    );
    press("Escape");
    expect(closeRightPanel).toHaveBeenCalledTimes(1);
    expect(closeFullscreen).not.toHaveBeenCalled();
  });

  it("closes Fullscreen Player next", () => {
    const closeFullscreen = vi.fn();
    mount(
      baseOptions({
        searchOpen: false,
        rightPanelOpen: false,
        fullscreenOpen: true,
        closeFullscreen,
      }),
    );
    press("Escape");
    expect(closeFullscreen).toHaveBeenCalledTimes(1);
  });

  it("falls back to the caller's Escape handler last (e.g. navigating back on the artist page)", () => {
    const onEscapeFallback = vi.fn(() => true);
    mount(baseOptions({ onEscapeFallback }));
    const event = press("Escape");
    expect(onEscapeFallback).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does nothing when there is no dismissible overlay open and the fallback declines", () => {
    const onEscapeFallback = vi.fn(() => false);
    mount(baseOptions({ onEscapeFallback }));
    const event = press("Escape");
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing when there is no dismissible overlay and no fallback is provided", () => {
    mount(baseOptions());
    const event = press("Escape");
    expect(event.defaultPrevented).toBe(false);
  });

  it("defers to an open dialog instead of closing Search itself", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("data-dialog-container", "true");
    document.body.appendChild(dialog);

    const closeSearch = vi.fn();
    mount(baseOptions({ searchOpen: true, closeSearch }));
    press("Escape");
    expect(closeSearch).not.toHaveBeenCalled();
  });

  it("still closes Search on Escape even while the search input is focused", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const closeSearch = vi.fn();
    mount(baseOptions({ searchOpen: true, closeSearch }));
    press("Escape", {}, input);
    expect(closeSearch).toHaveBeenCalledTimes(1);
  });
});
