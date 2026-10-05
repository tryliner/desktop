import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { SpeedPitchPicker } from "./SpeedPitchPicker";
import { playerEngine } from "../engine/playerEngine";
import { usePlayerStore } from "../store/playerStore";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("framer-motion", () => {
  const cache: Record<string, any> = {};
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: new Proxy({}, {
      get: (_target, prop: string) => {
        if (!cache[prop]) {
          cache[prop] = React.forwardRef(({ children, className, style, ...props }: any, ref: any) => {
            const cleanProps = { ...props };
            delete cleanProps.layout;
            delete cleanProps.layoutId;
            delete cleanProps.initial;
            delete cleanProps.animate;
            delete cleanProps.exit;
            delete cleanProps.transition;
            delete cleanProps.whileTap;
            delete cleanProps.whileHover;
            return React.createElement(prop, { ref, className, style, ...cleanProps }, children);
          });
        }
        return cache[prop];
      },
    }),
  };
});

describe("SpeedPitchPicker Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    usePlayerStore.setState({
      playbackRate: 1.0,
      pitchSemitones: 0.0,
      isPitchLinked: true,
      keepSpeedAcrossTracks: true,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
  });

  it("renders speed and pitch sliders", () => {
    act(() => {
      root?.render(<SpeedPitchPicker />);
    });

    const sliders = container?.querySelectorAll('[role="slider"]');
    expect(sliders?.length).toBe(2);
    expect(container?.textContent).toContain("x1.00");
    expect(container?.textContent).toContain("0.0 st");
  });

  it("renders presets and sets playback rate on click", () => {
    const setRateSpy = vi.spyOn(playerEngine, "setPlaybackRate");

    act(() => {
      root?.render(<SpeedPitchPicker />);
    });

    const buttons = container?.querySelectorAll("button");
    const speedUpButton = Array.from(buttons || []).find((b) => b.textContent?.includes("x1.25"));
    expect(speedUpButton).toBeDefined();

    act(() => {
      speedUpButton?.click();
    });

    expect(setRateSpy).toHaveBeenCalledWith(1.25);
  });

  it("allows setting back to normal speed with 1.0x preset", () => {
    usePlayerStore.setState({
      playbackRate: 1.25,
      pitchSemitones: 3.9,
    });

    const setRateSpy = vi.spyOn(playerEngine, "setPlaybackRate");

    act(() => {
      root?.render(<SpeedPitchPicker />);
    });

    const normalButton = Array.from(container?.querySelectorAll("button") || []).find((b) =>
      b.textContent?.includes("x1.0")
    );
    expect(normalButton).toBeDefined();

    act(() => {
      normalButton?.click();
    });

    expect(setRateSpy).toHaveBeenCalledWith(1.0);
  });
});
