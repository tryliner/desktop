import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { act } from "react";
import AppImage from "./AppImage";

describe("AppImage Letterbox Auto-Scaling", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("does not apply scale transform on square images (1:1 aspect ratio)", async () => {
    await act(async () => {
      root.render(<AppImage src="https://example.com/cover.jpg" width={100} height={100} />);
    });

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();

    // Mock natural dimensions for square artwork (512x512)
    Object.defineProperty(img, "naturalWidth", { value: 512, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 512, configurable: true });

    await act(async () => {
      img.dispatchEvent(new Event("load"));
    });

    expect(img.style.transform).not.toContain("scale(1.34)");
  });

  it("automatically scales up 4:3 / video thumbnails with letterbox bars (e.g. 480x360)", async () => {
    await act(async () => {
      root.render(<AppImage src="https://i.ytimg.com/vi/abc/hqdefault.jpg" width={100} height={100} />);
    });

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();

    // Mock natural dimensions for 4:3 YouTube thumbnail (480x360)
    Object.defineProperty(img, "naturalWidth", { value: 480, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 360, configurable: true });

    await act(async () => {
      img.dispatchEvent(new Event("load"));
    });

    expect(img.style.transform).toContain("scale(1.34)");
  });

  it("does not scale if autoCropLetterbox is false", async () => {
    await act(async () => {
      root.render(
        <AppImage
          src="https://i.ytimg.com/vi/abc/hqdefault.jpg"
          width={100}
          height={100}
          autoCropLetterbox={false}
        />,
      );
    });

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();

    Object.defineProperty(img, "naturalWidth", { value: 480, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 360, configurable: true });

    await act(async () => {
      img.dispatchEvent(new Event("load"));
    });

    expect(img.style.transform).not.toContain("scale(1.34)");
  });

  it("combines auto-scaling with user-provided transform style", async () => {
    await act(async () => {
      root.render(
        <AppImage
          src="https://i.ytimg.com/vi/abc/hqdefault.jpg"
          width={100}
          height={100}
          style={{ transform: "rotate(5deg)" }}
        />,
      );
    });

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();

    Object.defineProperty(img, "naturalWidth", { value: 480, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 360, configurable: true });

    await act(async () => {
      img.dispatchEvent(new Event("load"));
    });

    expect(img.style.transform).toContain("scale(1.34)");
    expect(img.style.transform).toContain("rotate(5deg)");
  });
});
