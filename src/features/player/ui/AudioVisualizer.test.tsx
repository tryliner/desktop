import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { AudioVisualizer } from "./AudioVisualizer";
import { installWebAudioMock, uninstallWebAudioMock } from "../../../../tests/e2e/mocks/webAudioMock";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AudioVisualizer Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    installWebAudioMock();
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
    uninstallWebAudioMock();
  });

  it("renders canvas element with data-testid", () => {
    act(() => {
      root?.render(<AudioVisualizer mode="bars" />);
    });

    const canvas = container?.querySelector('[data-testid="audio-visualizer"]');
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName.toLowerCase()).toBe("canvas");
  });

  it("applies mode and custom class names", () => {
    act(() => {
      root?.render(<AudioVisualizer mode="waveform" className="custom-viz-class" />);
    });

    let canvas = container?.querySelector('[data-testid="audio-visualizer"]');
    expect(canvas?.className).toContain("custom-viz-class");

    act(() => {
      root?.render(<AudioVisualizer mode="circle" className="custom-circle" />);
    });

    canvas = container?.querySelector('[data-testid="audio-visualizer"]');
    expect(canvas?.className).toContain("custom-circle");
  });

  it("respects isVisible prop", () => {
    act(() => {
      root?.render(<AudioVisualizer isVisible={false} />);
    });

    const canvas = container?.querySelector<HTMLCanvasElement>('[data-testid="audio-visualizer"]');
    expect(canvas?.style.display).toBe("none");

    act(() => {
      root?.render(<AudioVisualizer isVisible={true} />);
    });
    expect(canvas?.style.display).toBe("block");
  });
});
