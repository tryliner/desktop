import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCoverRegistry, getCoverElement, markCoverReady, useCoverElement } from "./coverArt";
import CoverImage from "../ui/CoverImage";

vi.mock("./coverSigner", () => ({ prepareCoverFallback: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => { clearCoverRegistry(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const image = () => {
  const element = document.createElement("img");
  Object.defineProperties(element, { naturalWidth: { value: 1024 }, naturalHeight: { value: 1024 } });
  return element;
};

describe("cover memory", () => {
  it("bounds unused decoded artwork rather than retaining browsing history", () => {
    for (let i = 0; i < 100; i++) markCoverReady(`cover-${i}`, undefined, image());
    expect(getCoverElement("cover-0")).toBeUndefined();
    expect(getCoverElement("cover-95")).toBeUndefined();
    expect(getCoverElement("cover-99")).toBeDefined();
  });

  it("preserves artwork with active consumers", async () => {
    markCoverReady("current", undefined, image());
    const host = document.createElement("div");
    const root = createRoot(host);
    function Current() { useCoverElement("current"); return null; }
    await act(async () => root.render(<Current />));
    for (let i = 0; i < 100; i++) markCoverReady(`cover-${i}`, undefined, image());
    expect(getCoverElement("current")).toBeDefined();
    await act(async () => root.unmount());
  });

  it("lets image lazy loading control requests instead of preloading every card", async () => {
    const preload = vi.spyOn(window, "Image");
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<CoverImage src="https://example.test/cover.jpg" alt="Cover" />));
    expect(host.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(preload).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
