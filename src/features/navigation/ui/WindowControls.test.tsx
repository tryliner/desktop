import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import WindowControls from "./WindowControls";
import type { WindowState } from "../../../../electron/preload";

describe("WindowControls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockMinimize: any;
  let mockToggleMaximize: any;
  let mockClose: any;
  let mockIsFullScreen: any;
  let mockIsMaximized: any;
  let stateListener: ((state: WindowState) => void) | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mockMinimize = vi.fn().mockResolvedValue(undefined);
    mockToggleMaximize = vi.fn().mockResolvedValue(undefined);
    mockClose = vi.fn().mockResolvedValue(undefined);
    mockIsFullScreen = vi.fn().mockResolvedValue(false);
    mockIsMaximized = vi.fn().mockResolvedValue(false);
    stateListener = null;

    (window as any).linerElectron = {
      minimize: mockMinimize,
      toggleMaximize: mockToggleMaximize,
      close: mockClose,
      isFullScreen: mockIsFullScreen,
      isMaximized: mockIsMaximized,
      onWindowStateChange: (cb: (state: WindowState) => void) => {
        stateListener = cb;
        return () => {
          stateListener = null;
        };
      },
    };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    delete (window as any).linerElectron;
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("renders buttons and handles maximize and close actions", async () => {
    await act(async () => {
      root.render(<WindowControls />);
    });

    const minimizeBtn = container.querySelector("button[aria-label='Minimize']") as HTMLButtonElement;
    const maximizeBtn = container.querySelector("button[title='Maximize']") as HTMLButtonElement;
    const closeBtn = container.querySelector("button[aria-label='Close']") as HTMLButtonElement;

    expect(minimizeBtn).toBeDefined();
    expect(maximizeBtn).toBeDefined();
    expect(closeBtn).toBeDefined();

    expect(minimizeBtn.disabled).toBe(false);

    await act(async () => {
      minimizeBtn.click();
    });
    expect(mockMinimize).toHaveBeenCalledTimes(1);

    await act(async () => {
      maximizeBtn.click();
    });
    expect(mockToggleMaximize).toHaveBeenCalledTimes(1);

    await act(async () => {
      closeBtn.click();
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("disables minimize button when initialized in fullscreen mode", async () => {
    mockIsFullScreen.mockResolvedValue(true);

    await act(async () => {
      root.render(<WindowControls />);
    });

    const minimizeBtn = container.querySelector("button[aria-label='Minimize']") as HTMLButtonElement;
    const maximizeBtn = container.querySelector("button[aria-label='Exit Fullscreen']") as HTMLButtonElement;

    expect(minimizeBtn.disabled).toBe(true);
    expect(minimizeBtn.getAttribute("aria-disabled")).toBe("true");
    expect(maximizeBtn).toBeDefined();

    await act(async () => {
      minimizeBtn.click();
    });
    expect(mockMinimize).not.toHaveBeenCalled();
  });

  it("updates minimize button state and tooltips when windowState changes dynamically", async () => {
    await act(async () => {
      root.render(<WindowControls />);
    });

    const minimizeBtn = container.querySelector("button[aria-label='Minimize']") as HTMLButtonElement;
    expect(minimizeBtn.disabled).toBe(false);

    // transition to fullscreen
    await act(async () => {
      stateListener?.({ isFullScreen: true, isMaximized: false });
    });

    expect(minimizeBtn.disabled).toBe(true);
    const exitFullscreenBtn = container.querySelector("button[aria-label='Exit Fullscreen']") as HTMLButtonElement;
    expect(exitFullscreenBtn).toBeDefined();

    // clicking minimize in fullscreen should not trigger IPC
    await act(async () => {
      minimizeBtn.click();
    });
    expect(mockMinimize).not.toHaveBeenCalled();

    // exit fullscreen
    await act(async () => {
      stateListener?.({ isFullScreen: false, isMaximized: true });
    });

    expect(minimizeBtn.disabled).toBe(false);
    const restoreBtn = container.querySelector("button[aria-label='Restore']") as HTMLButtonElement;
    expect(restoreBtn).toBeDefined();
  });

  it("disables minimize button when running on Hyprland", async () => {
    (window as any).linerElectron.isHyprland = true;

    await act(async () => {
      root.render(<WindowControls />);
    });

    const minimizeBtn = container.querySelector("button[aria-label='Minimize']") as HTMLButtonElement;
    expect(minimizeBtn.disabled).toBe(true);
    expect(minimizeBtn.getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      minimizeBtn.click();
    });
    expect(mockMinimize).not.toHaveBeenCalled();
  });
});
