import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { useWindowState, type WindowStateHookResult } from "./useWindowState";
import type { WindowState } from "../../../../electron/preload";

describe("useWindowState", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestState: WindowStateHookResult | null = null;
  let mockIsFullScreen: any;
  let mockIsMaximized: any;
  let stateListener: ((state: WindowState) => void) | null = null;
  let unsubscribeSpy: any;

  function TestHarness() {
    const state = useWindowState();
    latestState = state;
    return (
      <div
        data-testid="window-state"
        data-maximized={state.isMaximized}
        data-fullscreen={state.isFullScreen}
        data-edgetoedge={state.isEdgeToEdge}
      />
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestState = null;
    stateListener = null;
    unsubscribeSpy = vi.fn(() => {
      stateListener = null;
    });
    mockIsFullScreen = vi.fn().mockResolvedValue(false);
    mockIsMaximized = vi.fn().mockResolvedValue(false);
    document.body.className = "h-full w-full bg-transparent overflow-hidden p-1";
    document.body.removeAttribute("data-edge-to-edge");

    (window as any).linerElectron = {
      isFullScreen: mockIsFullScreen,
      isMaximized: mockIsMaximized,
      toggleFullScreen: vi.fn().mockResolvedValue(undefined),
      onWindowStateChange: (cb: (state: WindowState) => void) => {
        stateListener = cb;
        return unsubscribeSpy;
      },
    };
  });

  afterEach(async () => {
    if (root && container) {
      await act(async () => {
        root!.unmount();
      });
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
    root = null;
    container = null;
    latestState = null;
    delete (window as any).linerElectron;
    vi.restoreAllMocks();
  });

  async function mount() {
    await act(async () => {
      root!.render(<TestHarness />);
    });
  }

  it("returns false for all states initially when not maximized or fullscreen", async () => {
    await mount();

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: false,
      isEdgeToEdge: false,
    });
    expect(mockIsFullScreen).toHaveBeenCalled();
    expect(mockIsMaximized).toHaveBeenCalled();
  });

  it("hydrates initial maximized state from electron", async () => {
    mockIsMaximized.mockResolvedValue(true);

    await mount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(latestState).toEqual({
      isMaximized: true,
      isFullScreen: false,
      isEdgeToEdge: true,
    });
  });

  it("hydrates initial fullscreen state from electron", async () => {
    mockIsFullScreen.mockResolvedValue(true);

    await mount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: true,
      isEdgeToEdge: true,
    });
  });

  it("updates state when onWindowStateChange event fires", async () => {
    await mount();

    expect(stateListener).toBeTypeOf("function");

    // Maximize window
    await act(async () => {
      stateListener!({ isMaximized: true, isFullScreen: false });
    });

    expect(latestState).toEqual({
      isMaximized: true,
      isFullScreen: false,
      isEdgeToEdge: true,
    });

    // Restore window
    await act(async () => {
      stateListener!({ isMaximized: false, isFullScreen: false });
    });

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: false,
      isEdgeToEdge: false,
    });

    // Fullscreen window
    await act(async () => {
      stateListener!({ isMaximized: false, isFullScreen: true });
    });

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: true,
      isEdgeToEdge: true,
    });
  });

  it("re-checks window state on resize event", async () => {
    await mount();

    mockIsMaximized.mockResolvedValue(true);

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      await Promise.resolve();
    });

    expect(latestState).toEqual({
      isMaximized: true,
      isFullScreen: false,
      isEdgeToEdge: true,
    });
  });

  it("unsubscribes and cleans up listeners on unmount", async () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    await mount();

    await act(async () => {
      root!.unmount();
    });
    root = null;

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("works safely when window.linerElectron is undefined (browser mode)", async () => {
    delete (window as any).linerElectron;

    await mount();

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: false,
      isEdgeToEdge: false,
    });
  });

  it("enters and exits fullscreen via fullscreenchange in browser mode", async () => {
    delete (window as any).linerElectron;

    await mount();

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: false,
      isEdgeToEdge: false,
    });

    // Enter fullscreen
    const mockElement = document.createElement("div");
    Object.defineProperty(document, "fullscreenElement", {
      value: mockElement,
      configurable: true,
      writable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: true,
      isEdgeToEdge: true,
    });

    // Exit fullscreen
    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
      writable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: false,
      isEdgeToEdge: false,
    });
  });

  it("handles IPC query promise rejections gracefully without unhandled errors", async () => {
    mockIsFullScreen.mockRejectedValue(new Error("IPC failed"));
    mockIsMaximized.mockRejectedValue(new Error("IPC failed"));

    await mount();

    expect(latestState).toEqual({
      isMaximized: false,
      isFullScreen: false,
      isEdgeToEdge: false,
    });
  });

  it("ignores IPC query results that resolve after a newer onWindowStateChange push event", async () => {
    let resolveFsQuery: (val: boolean) => void = () => {};
    mockIsFullScreen.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFsQuery = resolve;
        }),
    );

    await act(async () => {
      root!.render(<TestHarness />);
    });

    // A newer push event arrives before the initial query resolves
    await act(async () => {
      stateListener?.({ isFullScreen: false, isMaximized: true });
    });

    expect(latestState?.isMaximized).toBe(true);
    expect(latestState?.isFullScreen).toBe(false);

    // Now the older query resolves with true (stale)
    await act(async () => {
      resolveFsQuery(true);
    });

    // Stale query result should be ignored
    expect(latestState?.isFullScreen).toBe(false);
  });

  it("prevents default on F11 keydown to disable uncoordinated fullscreen", async () => {
    await mount();

    const event = new KeyboardEvent("keydown", { key: "F11", cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("updates document.body classes and data-edge-to-edge attribute", async () => {
    await mount();

    expect(document.body.getAttribute("data-edge-to-edge")).toBeNull();
    expect(document.body.classList.contains("p-1")).toBe(true);
    expect(document.body.classList.contains("p-0")).toBe(false);

    // Maximize window
    await act(async () => {
      stateListener!({ isMaximized: true, isFullScreen: false });
    });

    expect(document.body.getAttribute("data-edge-to-edge")).toBe("true");
    expect(document.body.classList.contains("p-0")).toBe(true);
    expect(document.body.classList.contains("p-1")).toBe(false);

    // Restore window
    await act(async () => {
      stateListener!({ isMaximized: false, isFullScreen: false });
    });

    expect(document.body.getAttribute("data-edge-to-edge")).toBeNull();
    expect(document.body.classList.contains("p-1")).toBe(true);
    expect(document.body.classList.contains("p-0")).toBe(false);
  });
});
