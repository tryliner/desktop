import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { useGlobalShortcuts, type GlobalShortcutsOptions } from "./useGlobalShortcuts";

const playerState = { volume: 1, positionMs: 10_000, durationMs: 60_000 };

vi.mock("@/features/player", () => ({
  playerEngine: {
    togglePlayPause: vi.fn(),
    seek: vi.fn((ms: number) => {
      playerState.positionMs = ms;
    }),
    setVolume: vi.fn((v: number) => {
      playerState.volume = v;
    }),
  },
  usePlayerStore: { getState: () => playerState },
  toVolumeGain: (level: number) => level,
  toVolumeLevel: (gain: number) => gain,
}));

import { playerEngine } from "@/features/player";

function baseOptions(overrides: Partial<GlobalShortcutsOptions> = {}): GlobalShortcutsOptions {
  return {
    searchOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    queueOpen: false,
    openQueue: vi.fn(),
    closeQueue: vi.fn(),
    fullscreenOpen: false,
    openFullscreen: vi.fn(),
    closeFullscreen: vi.fn(),
    ...overrides,
  };
}

function Harness({ options }: { options: GlobalShortcutsOptions }) {
  useGlobalShortcuts(options);
  return null;
}

function mount(options: GlobalShortcutsOptions): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness options={options} />);
  });
  return { container, root };
}

function press(
  code: string,
  init: Partial<KeyboardEventInit> = {},
  target: EventTarget = document,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("useGlobalShortcuts", () => {
  let mounted: { container: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    playerState.volume = 1;
    playerState.positionMs = 10_000;
    playerState.durationMs = 60_000;
  });

  afterEach(() => {
    if (mounted) {
      act(() => {
        mounted!.root.unmount();
      });
      document.body.removeChild(mounted.container);
      mounted = null;
    }
    document.body.innerHTML = "";
  });

  it("Space toggles play/pause and prevents the default page scroll", () => {
    mounted = mount(baseOptions());
    const event = press("Space");
    expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not toggle Play/Pause while typing in an input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    mounted = mount(baseOptions());
    const event = press("Space", {}, input);

    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("F opens Fullscreen Player when closed, and closes it when open", () => {
    const openFullscreen = vi.fn();
    mounted = mount(baseOptions({ fullscreenOpen: false, openFullscreen }));
    press("KeyF");
    expect(openFullscreen).toHaveBeenCalledTimes(1);

    act(() => mounted!.root.unmount());
    document.body.removeChild(mounted.container);

    const closeFullscreen = vi.fn();
    mounted = mount(baseOptions({ fullscreenOpen: true, closeFullscreen }));
    press("KeyF");
    expect(closeFullscreen).toHaveBeenCalledTimes(1);
  });

  it("Q opens and closes the Queue without affecting playback", () => {
    const openQueue = vi.fn();
    mounted = mount(baseOptions({ queueOpen: false, openQueue }));
    press("KeyQ");
    expect(openQueue).toHaveBeenCalledTimes(1);
    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
    expect(playerEngine.seek).not.toHaveBeenCalled();
  });

  it("M mutes and restores the previous volume level on toggle", () => {
    playerState.volume = 0.65;
    mounted = mount(baseOptions());

    press("KeyM");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0);

    press("KeyM");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0.65);
  });

  it("/ opens Search and prevents the character from being typed elsewhere", () => {
    const openSearch = vi.fn();
    mounted = mount(baseOptions({ openSearch }));
    const event = press("Slash");
    expect(openSearch).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not open Search while the user is typing (e.g. a literal '/' in a field)", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const openSearch = vi.fn();
    mounted = mount(baseOptions({ openSearch }));
    const event = press("Slash", {}, input);

    expect(openSearch).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("seeks 5s backward and forward, clamped to [0, duration]", () => {
    playerState.positionMs = 10_000;
    playerState.durationMs = 60_000;
    mounted = mount(baseOptions());

    press("ArrowRight");
    expect(playerEngine.seek).toHaveBeenLastCalledWith(15_000);

    playerState.positionMs = 15_000;
    press("ArrowLeft");
    expect(playerEngine.seek).toHaveBeenLastCalledWith(10_000);
  });

  it("does not seek before 0:00", () => {
    playerState.positionMs = 2_000;
    mounted = mount(baseOptions());
    press("ArrowLeft");
    expect(playerEngine.seek).toHaveBeenLastCalledWith(0);
  });

  it("adjusts volume by 5%, clamped to [0, 1]", () => {
    playerState.volume = 0.6;
    mounted = mount(baseOptions());

    press("ArrowUp");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0.65);

    playerState.volume = 0.6;
    press("ArrowDown");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0.55);

    playerState.volume = 0.98;
    press("ArrowUp");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(1);
  });

  it("lets a focused volume slider (role=slider) handle arrow keys instead of the global shortcut", () => {
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    document.body.appendChild(slider);

    mounted = mount(baseOptions());
    const event = press("ArrowUp", {}, slider);

    expect(playerEngine.setVolume).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets a focused button handle Space instead of toggling playback", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);

    mounted = mount(baseOptions());
    const event = press("Space", {}, button);

    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores shortcuts combined with Ctrl/Cmd/Alt so browser shortcuts keep working", () => {
    mounted = mount(baseOptions({ openFullscreen: vi.fn() }));

    const ctrlF = press("KeyF", { ctrlKey: true });
    expect(ctrlF.defaultPrevented).toBe(false);

    const altLeft = press("ArrowLeft", { altKey: true });
    expect(altLeft.defaultPrevented).toBe(false);
    expect(playerEngine.seek).not.toHaveBeenCalled();
  });

  it("ignores shortcuts while a dialog is open", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("data-dialog-container", "true");
    document.body.appendChild(dialog);

    mounted = mount(baseOptions());
    press("Space");
    press("KeyF");

    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
  });

  it("does not fire the toggle shortcuts repeatedly while a key is held", () => {
    mounted = mount(baseOptions());
    press("Space", { repeat: false });
    press("Space", { repeat: true });
    expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(1);
  });

  it("still allows held arrow keys to keep seeking/adjusting volume", () => {
    mounted = mount(baseOptions());
    press("ArrowRight", { repeat: true });
    expect(playerEngine.seek).toHaveBeenCalledTimes(1);
  });

  describe("Escape priority", () => {
    it("closes Search first when Search, Queue and Fullscreen are all open", () => {
      const closeSearch = vi.fn();
      const closeQueue = vi.fn();
      const closeFullscreen = vi.fn();
      mounted = mount(
        baseOptions({
          searchOpen: true,
          closeSearch,
          queueOpen: true,
          closeQueue,
          fullscreenOpen: true,
          closeFullscreen,
        }),
      );
      press("Escape");
      expect(closeSearch).toHaveBeenCalledTimes(1);
      expect(closeQueue).not.toHaveBeenCalled();
      expect(closeFullscreen).not.toHaveBeenCalled();
    });

    it("closes Queue next once Search is already closed", () => {
      const closeQueue = vi.fn();
      const closeFullscreen = vi.fn();
      mounted = mount(
        baseOptions({
          searchOpen: false,
          queueOpen: true,
          closeQueue,
          fullscreenOpen: true,
          closeFullscreen,
        }),
      );
      press("Escape");
      expect(closeQueue).toHaveBeenCalledTimes(1);
      expect(closeFullscreen).not.toHaveBeenCalled();
    });

    it("closes Fullscreen Player last", () => {
      const closeFullscreen = vi.fn();
      mounted = mount(
        baseOptions({ searchOpen: false, queueOpen: false, fullscreenOpen: true, closeFullscreen }),
      );
      press("Escape");
      expect(closeFullscreen).toHaveBeenCalledTimes(1);
    });

    it("does nothing when there is no dismissible overlay open", () => {
      mounted = mount(baseOptions());
      const event = press("Escape");
      expect(event.defaultPrevented).toBe(false);
    });

    it("defers to an open dialog instead of closing Search itself", () => {
      const dialog = document.createElement("div");
      dialog.setAttribute("data-dialog-container", "true");
      document.body.appendChild(dialog);

      const closeSearch = vi.fn();
      mounted = mount(baseOptions({ searchOpen: true, closeSearch }));
      press("Escape");
      expect(closeSearch).not.toHaveBeenCalled();
    });

    it("still closes Search on Escape even while the search input is focused", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      const closeSearch = vi.fn();
      mounted = mount(baseOptions({ searchOpen: true, closeSearch }));
      press("Escape", {}, input);
      expect(closeSearch).toHaveBeenCalledTimes(1);
    });
  });
});
