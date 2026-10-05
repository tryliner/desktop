import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { VolumePicker } from "./VolumePicker";
import { playerEngine } from "../engine/playerEngine";

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
            delete cleanProps.initial;
            delete cleanProps.animate;
            delete cleanProps.exit;
            delete cleanProps.transition;
            return React.createElement(prop, { ref, className, style, ...cleanProps }, children);
          });
        }
        return cache[prop];
      },
    }),
  };
});

describe("VolumePicker Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("renders volume slider and percentage value", () => {
    act(() => {
      root?.render(<VolumePicker showValue showIcon />);
    });

    const slider = container?.querySelector('[role="slider"]');
    expect(slider).not.toBeNull();
    expect(slider?.getAttribute("aria-label")).toBe("Volume");
  });

  it("calls onVolumeChange when keyboard navigation is used", () => {
    const handleVolumeChange = vi.fn();
    const setVolumeSpy = vi.spyOn(playerEngine, "setVolume").mockImplementation(() => {});

    act(() => {
      root?.render(<VolumePicker onVolumeChange={handleVolumeChange} />);
    });

    const slider = container?.querySelector('[role="slider"]') as HTMLElement;
    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });

    expect(handleVolumeChange).toHaveBeenCalled();
    setVolumeSpy.mockRestore();
  });
});
