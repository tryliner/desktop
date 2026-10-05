import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { PillTabs } from "./PillTabs";

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
            delete cleanProps.layoutId;
            delete cleanProps.transition;
            return React.createElement(prop, { ref, className, style, ...cleanProps }, children);
          });
        }
        return cache[prop];
      },
    }),
  };
});

describe("PillTabs Component", () => {
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

  it("renders all tabs and highlights active tab", () => {
    const tabs = ["pistol", "smg", "rifle"];
    const handleChange = vi.fn();

    act(() => {
      root?.render(<PillTabs tabs={tabs} activeTab="pistol" onChange={handleChange} />);
    });

    const renderedTabs = container?.querySelectorAll('[role="tab"]');
    expect(renderedTabs?.length).toBe(3);
    expect(renderedTabs?.[0].getAttribute("aria-selected")).toBe("true");
    expect(renderedTabs?.[1].getAttribute("aria-selected")).toBe("false");
  });

  it("calls onChange when a tab is clicked", () => {
    const tabs = [
      { id: "pistol", label: "Pistol" },
      { id: "smg", label: "SMG" },
    ];
    const handleChange = vi.fn();

    act(() => {
      root?.render(<PillTabs tabs={tabs} activeTab="pistol" onChange={handleChange} />);
    });

    const secondTab = container?.querySelectorAll('[role="tab"]')?.[1] as HTMLElement;
    act(() => {
      secondTab.click();
    });

    expect(handleChange).toHaveBeenCalledWith("smg");
  });
});
