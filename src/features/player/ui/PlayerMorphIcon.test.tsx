import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import {
  PlayerMorphIcon,
  ICON_PLAY,
  ICON_PAUSE,
  ICON_VOLUME_MUTE,
} from "./morphPlayerIcons";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("PlayerMorphIcon rendered markup", () => {
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

  it("paints fill on the svg root so shapes inherit it (no lucide stroke)", () => {
    act(() => {
      root?.render(<PlayerMorphIcon icon={ICON_PLAY} size={16} />);
    });

    const svg = container?.querySelector("svg");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
    // play/pause: nonzero — their morph overlaps source/target subpaths
    // mid-flight and evenodd would hole out the overlap (transparency flash)
    expect(svg?.getAttribute("fill-rule")).toBe("nonzero");
    // MorphIcon defaults to stroke=currentColor stroke-width=2 (lucide style),
    // which fattens every fill shape — must be off at the root
    expect(svg?.getAttribute("stroke")).toBe("none");

    const path = svg?.querySelector("path");
    expect(path).not.toBeNull();
    // solar Play Bold geometry (canonical resampling rounds to 4 decimals)
    expect(path?.getAttribute("d")?.startsWith("M21.4086 9.3526")).toBe(true);
  });

  it("shows the pause endpoint geometry for the pause icon", () => {
    act(() => {
      root?.render(<PlayerMorphIcon icon={ICON_PAUSE} size={16} />);
    });

    const path = container?.querySelector("path");
    expect(path?.getAttribute("d")?.startsWith("M2 6C2 4.1144")).toBe(true);
  });

  it("keeps evenodd fill rule for icons whose geometry needs it", () => {
    act(() => {
      root?.render(<PlayerMorphIcon icon={ICON_VOLUME_MUTE} size={16} />);
    });

    const svg = container?.querySelector("svg");
    // the mute slash crosses the speaker body — nonzero would fill the
    // silhouette hole like solar's evenodd def avoids
    expect(svg?.getAttribute("fill-rule")).toBe("evenodd");
  });

  it("keeps the VolumePicker mute geometry verbatim (solar VolumeCross Bold)", () => {
    act(() => {
      root?.render(<PlayerMorphIcon icon={ICON_VOLUME_MUTE} size={16} />);
    });

    const path = container?.querySelector("path");
    expect(path?.getAttribute("d")?.startsWith("M20.5145 6.3164")).toBe(true);
  });
});
