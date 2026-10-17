import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import { OverlayPlayer } from "./OverlayPlayer";

// @/features/settings re-exports the settings tabs, pulling lottie-web into
// the test env; stub only what OverlayPlayer reads
vi.mock("@/features/settings", () => {
  const storeState = {
    backgroundImage: null,
    backgroundBlur: 0,
    backgroundDim: 0,
    contentView: { opacity: 60, blur: 20, dim: 15 },
    miniplayer: { opacity: 60, blur: 20, dim: 15 },
  };
  return {
    useCustomizationStore: (selector: (state: typeof storeState) => unknown) =>
      selector(storeState),
    loadPersistedWallpaper: vi.fn().mockResolvedValue(null),
    DEFAULT_GLASS_CONFIG: { opacity: 60, blur: 20, dim: 15 },
  };
});

type OverlayAction = { type: string; payload?: { volume?: number } };

function wireElectronApi(sendOverlayAction: (action: OverlayAction) => void) {
  (
    window as unknown as {
      linerElectron: Partial<{
        sendOverlayAction: (action: OverlayAction) => void;
      }>;
    }
  ).linerElectron = { sendOverlayAction };
}

describe("OverlayPlayer volume wheel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
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
    delete (window as unknown as { linerElectron?: unknown }).linerElectron;
  });

  function mount() {
    root = createRoot(container!);
    act(() => {
      root!.render(<OverlayPlayer />);
    });
  }

  function volumeButton(): HTMLButtonElement {
    const button = container!.querySelector<HTMLButtonElement>(
      'button[title^="Volume"]',
    );
    if (!button) throw new Error("volume button not rendered");
    return button;
  }

  function wheelOn(button: HTMLButtonElement, deltaY: number) {
    act(() => {
      button.dispatchEvent(
        new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }),
      );
    });
  }

  it("renders the volume icon on the right cluster", () => {
    wireElectronApi(vi.fn());
    mount();
    expect(volumeButton()).toBeTruthy();
  });

  it("scrolls up towards volumeUp", () => {
    const sendOverlayAction = vi.fn();
    wireElectronApi(sendOverlayAction);
    mount();

    wheelOn(volumeButton(), -120);
    expect(sendOverlayAction).toHaveBeenCalledWith({ type: "volumeUp" });
    expect(sendOverlayAction).toHaveBeenCalledTimes(1);
  });

  it("scrolls down towards volumeDown", () => {
    const sendOverlayAction = vi.fn();
    wireElectronApi(sendOverlayAction);
    mount();

    wheelOn(volumeButton(), 120);
    expect(sendOverlayAction).toHaveBeenCalledWith({ type: "volumeDown" });
    expect(sendOverlayAction).toHaveBeenCalledTimes(1);
  });

  it("keeps sending one action per wheel tick", () => {
    const sendOverlayAction = vi.fn();
    wireElectronApi(sendOverlayAction);
    mount();
    const button = volumeButton();

    wheelOn(button, -120);
    wheelOn(button, -120);
    wheelOn(button, 120);
    const types = sendOverlayAction.mock.calls.map(
      ([action]) => (action as OverlayAction).type,
    );
    expect(types).toEqual(["volumeUp", "volumeUp", "volumeDown"]);
  });
});
