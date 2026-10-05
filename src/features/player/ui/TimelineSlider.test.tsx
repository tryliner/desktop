import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { TimelineSlider, formatPlaybackTime } from "./TimelineSlider";

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

describe("TimelineSlider Component", () => {
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

  it("formats playback time correctly", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65000)).toBe("1:05");
    expect(formatPlaybackTime(3600000)).toBe("60:00");
  });

  it("renders with seek slider and shows formatted time", () => {
    const handleSeek = vi.fn();
    act(() => {
      root?.render(
        <TimelineSlider
          positionMs={30000}
          durationMs={180000}
          onSeek={handleSeek}
          showTime
        />
      );
    });

    const slider = container?.querySelector('[role="slider"]');
    expect(slider).not.toBeNull();
    expect(container?.textContent).toContain("0:30");
    expect(container?.textContent).toContain("3:00");
  });

  it("handles keyboard seek (ArrowRight/ArrowLeft/Home/End)", () => {
    const handleSeek = vi.fn();
    act(() => {
      root?.render(
        <TimelineSlider
          positionMs={30000}
          durationMs={180000}
          onSeek={handleSeek}
        />
      );
    });

    const slider = container?.querySelector('[role="slider"]') as HTMLElement;
    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(handleSeek).toHaveBeenCalledWith(35000);

    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(handleSeek).toHaveBeenCalledWith(25000);

    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    expect(handleSeek).toHaveBeenCalledWith(0);

    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    expect(handleSeek).toHaveBeenCalledWith(180000);
  });
});
