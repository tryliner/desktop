import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useIsWindowFullScreen } from "./useIsWindowFullScreen";

type WindowStateCb = (state: {
  isFullScreen: boolean;
  isMaximized: boolean;
}) => void;
type Unsubscribe = () => void;

const electronApi = {
  isFullScreen: vi.fn<() => Promise<boolean>>(),
  isMaximized: vi.fn<() => Promise<boolean>>(),
  onWindowStateChange: vi.fn<(cb: WindowStateCb) => Unsubscribe>(),
};

let latest: boolean | null = null;
let emitWindowState: WindowStateCb | null = null;

function Harness() {
  latest = useIsWindowFullScreen();
  return null;
}

describe("useIsWindowFullScreen", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    // windowed-by-default viewport (1200x780 floating shell on 1920x1080)
    window.innerWidth = 1200;
    window.innerHeight = 780;
    Object.defineProperty(window.screen, "width", {
      value: 1920,
      configurable: true,
    });
    Object.defineProperty(window.screen, "height", {
      value: 1080,
      configurable: true,
    });

    window.linerElectron = {
      ...window.linerElectron,
      isFullScreen: electronApi.isFullScreen,
      isMaximized: electronApi.isMaximized,
      onWindowStateChange: electronApi.onWindowStateChange,
    } as typeof window.linerElectron;
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
      document.body.removeChild(container);
    }
    root = null;
    container = null;
    document.body.innerHTML = "";
    delete (window as { linerElectron?: unknown }).linerElectron;
    emitWindowState = null;
    vi.clearAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<Harness />);
    });
  }

  function stubWindow(initialFullScreen: boolean) {
    electronApi.isFullScreen.mockResolvedValue(initialFullScreen);
    electronApi.isMaximized.mockResolvedValue(false);
    electronApi.onWindowStateChange.mockImplementation((cb) => {
      emitWindowState = cb;
      return () => {
        /* unsubscribed */
      };
    });
  }

  it("starts square-by-default: false with a windowed os window", async () => {
    stubWindow(false);
    mount();
    expect(latest).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(latest).toBe(false);
  });

  it("hydrates true when the window opens already fullscreen", async () => {
    stubWindow(true);
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(latest).toBe(true);
  });

  it("follows window:state-changed broadcasts both ways", async () => {
    stubWindow(false);
    mount();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      emitWindowState?.({ isFullScreen: true, isMaximized: false });
    });
    expect(latest).toBe(true);

    act(() => {
      emitWindowState?.({ isFullScreen: false, isMaximized: false });
    });
    expect(latest).toBe(false);
  });

  it("falls back to the viewport when the compositor fullscreens without events", async () => {
    stubWindow(false);
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(latest).toBe(false);

    // meta-f on kde wayland: the viewport covers the whole screen and no
    // electron event fires
    await act(async () => {
      window.innerWidth = 1920;
      window.innerHeight = 1080;
      window.dispatchEvent(new Event("resize"));
      await Promise.resolve();
    });
    expect(latest).toBe(true);

    // leaving fullscreen restores the windowed shell
    await act(async () => {
      window.innerWidth = 1200;
      window.innerHeight = 780;
      window.dispatchEvent(new Event("resize"));
      await Promise.resolve();
    });
    expect(latest).toBe(false);
  });

  it("keeps maximized windows rounded even when the viewport covers the screen", async () => {
    stubWindow(false);
    mount();
    await act(async () => {
      await Promise.resolve();
    });

    // panel-less desktop: maximize also covers the whole screen, so the
    // os truth must gate the viewport fallback
    act(() => {
      emitWindowState?.({ isFullScreen: false, isMaximized: true });
    });

    await act(async () => {
      window.innerWidth = 1920;
      window.innerHeight = 1080;
      window.dispatchEvent(new Event("resize"));
      await Promise.resolve();
    });
    expect(latest).toBe(false);

    // leaving maximize is enough for the windowed look again
    act(() => {
      emitWindowState?.({ isFullScreen: false, isMaximized: false });
    });
    await act(async () => {
      window.innerWidth = 1200;
      window.innerHeight = 780;
      window.dispatchEvent(new Event("resize"));
      await Promise.resolve();
    });
    expect(latest).toBe(false);

    // a real fullscreen event wins regardless of the maximize flag
    act(() => {
      emitWindowState?.({ isFullScreen: true, isMaximized: false });
    });
    expect(latest).toBe(true);
  });

  it("unsubscribes from broadcasts on unmount", async () => {
    let unsubscribed = false;
    electronApi.isFullScreen.mockResolvedValue(false);
    electronApi.onWindowStateChange.mockImplementation((cb) => {
      emitWindowState = cb;
      return () => {
        unsubscribed = true;
      };
    });

    mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(typeof emitWindowState).toBe("function");

    act(() => {
      root!.unmount();
    });
    root = null;
    expect(unsubscribed).toBe(true);
  });
});
