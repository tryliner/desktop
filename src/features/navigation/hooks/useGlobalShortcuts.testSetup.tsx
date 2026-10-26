import React from "react";
import { vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import {
  useGlobalShortcuts,
  type GlobalShortcutsOptions,
} from "./useGlobalShortcuts";

export const playerState: {
  volume: number;
  positionMs: number;
  durationMs: number;
  currentTrack: { id: string } | null;
  status: "idle" | "loading" | "playing" | "paused" | "error";
} = {
  volume: 1,
  positionMs: 10_000,
  durationMs: 60_000,
  currentTrack: null,
  status: "idle",
};

const playerEngine = vi.hoisted(() => ({
  togglePlayPause: vi.fn(),
  seek: vi.fn((ms: number) => {
    playerState.positionMs = ms;
  }),
  setVolume: vi.fn((v: number) => {
    playerState.volume = v;
  }),
}));

vi.mock("@/features/player", () => ({
  playerEngine,
  usePlayerStore: { getState: () => playerState },
  toVolumeGain: (level: number) => level,
  toVolumeLevel: (gain: number) => gain,
}));

export { playerEngine };

export function baseOptions(
  overrides: Partial<GlobalShortcutsOptions> = {},
): GlobalShortcutsOptions {
  return {
    searchOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    rightPanelOpen: false,
    openRightPanel: vi.fn(),
    closeRightPanel: vi.fn(),
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

export function mount(options: GlobalShortcutsOptions): {
  container: HTMLDivElement;
  root: Root;
} {
  unmount();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness options={options} />);
  });
  mounted = { container, root };
  return mounted;
}

export function press(
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

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function unmount() {
  if (mounted) {
    act(() => mounted!.root.unmount());
    document.body.removeChild(mounted.container);
    mounted = null;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  playerState.volume = 1;
  playerState.positionMs = 10_000;
  playerState.durationMs = 60_000;
  playerState.currentTrack = null;
  playerState.status = "idle";
});

afterEach(() => {
  unmount();
  document.body.innerHTML = "";
});
