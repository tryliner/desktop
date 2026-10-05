import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { Slider } from "./Slider";

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
            delete cleanProps.whileHover;
            delete cleanProps.whileTap;
            return React.createElement(prop, { ref, className, style, ...cleanProps }, children);
          });
        }
        return cache[prop];
      },
    }),
  };
});

describe("Slider Component", () => {
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

  it("renders inline with default props and displays value", () => {
    const handleChange = vi.fn();
    act(() => {
      root?.render(<Slider value={50} onChange={handleChange} unit="%" />);
    });

    const slider = container?.querySelector('[role="slider"]');
    expect(slider).not.toBeNull();
    expect(container?.textContent).toContain("50%");
  });

  it("renders with label in stacked layout", () => {
    const handleChange = vi.fn();
    act(() => {
      root?.render(
        <Slider
          value={80}
          onChange={handleChange}
          label="Hit Chance"
          unit="%"
        />
      );
    });

    expect(container?.textContent).toContain("Hit Chance");
    expect(container?.textContent).toContain("80%");
  });

  it("handles keyboard navigation (ArrowRight / ArrowLeft)", () => {
    const handleChange = vi.fn();
    act(() => {
      root?.render(
        <Slider
          value={50}
          min={0}
          max={100}
          step={5}
          onChange={handleChange}
        />
      );
    });

    const slider = container?.querySelector('[role="slider"]') as HTMLElement;
    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(55);

    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(45);
  });

  it("handles Home and End keys", () => {
    const handleChange = vi.fn();
    act(() => {
      root?.render(
        <Slider
          value={50}
          min={0}
          max={100}
          step={1}
          onChange={handleChange}
        />
      );
    });

    const slider = container?.querySelector('[role="slider"]') as HTMLElement;
    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(0);

    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(100);
  });

  it("respects disabled state", () => {
    const handleChange = vi.fn();
    act(() => {
      root?.render(
        <Slider
          value={50}
          disabled={true}
          onChange={handleChange}
        />
      );
    });

    const slider = container?.querySelector('[role="slider"]') as HTMLElement;
    expect(slider.getAttribute("aria-disabled")).toBe("true");

    act(() => {
      slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(handleChange).not.toHaveBeenCalled();
  });
});
