import { describe, expect, it, beforeEach } from "vitest";
import { useVisualizerStore } from "./store/visualizerStore";

describe("Visualizer Store", () => {
  beforeEach(() => {
    useVisualizerStore.setState({ mode: "bars" });
  });

  it("initializes with default mode", () => {
    expect(useVisualizerStore.getState().mode).toBe("bars");
  });

  it("updates visualizer mode", () => {
    useVisualizerStore.getState().setMode("wave");
    expect(useVisualizerStore.getState().mode).toBe("wave");

    useVisualizerStore.getState().setMode("off");
    expect(useVisualizerStore.getState().mode).toBe("off");
  });

  it("cycles through modes via toggleMode", () => {
    expect(useVisualizerStore.getState().mode).toBe("bars");

    useVisualizerStore.getState().toggleMode();
    expect(useVisualizerStore.getState().mode).toBe("wave");

    useVisualizerStore.getState().toggleMode();
    expect(useVisualizerStore.getState().mode).toBe("off");

    useVisualizerStore.getState().toggleMode();
    expect(useVisualizerStore.getState().mode).toBe("bars");
  });
});
