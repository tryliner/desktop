import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { DownloadButton } from "./DownloadButton";
import { useDownloadStore } from "../store/downloadStore";
import { audioCache } from "@/shared/storage/audioCache";

// @ts-expect-error - act support flag in vitest
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DownloadButton", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useDownloadStore.setState({
      downloads: new Map(),
      activeCount: 0,
    });
    vi.restoreAllMocks();
    vi.spyOn(audioCache, "hasAudio").mockResolvedValue(false);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  it("renders download button in idle state and triggers download on click", async () => {
    await act(async () => {
      root?.render(<DownloadButton trackId="track-123" />);
    });

    const button = container?.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toContain("Download for offline playback");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useDownloadStore.getState().downloads.has("track-123")).toBe(true);
  });

  it("renders disabled checkmark button when already cached", async () => {
    vi.spyOn(audioCache, "hasAudio").mockResolvedValue(true);

    await act(async () => {
      root?.render(<DownloadButton trackId="cached-track" />);
    });

    const button = container?.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toContain("Saved offline");
    expect(button?.disabled).toBe(true);
  });

  it("renders spinning indicator during active download", async () => {
    const downloads = new Map();
    downloads.set("dl-track", { trackId: "dl-track", status: "downloading", progress: 60 });
    useDownloadStore.setState({ downloads });

    await act(async () => {
      root?.render(<DownloadButton trackId="dl-track" />);
    });

    const button = container?.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toContain("Downloading");
    expect(button?.disabled).toBe(true);
  });

  it("renders retry button on download error", async () => {
    const downloads = new Map();
    downloads.set("err-track", { trackId: "err-track", status: "error", progress: 0, error: "Failed" });
    useDownloadStore.setState({ downloads });

    await act(async () => {
      root?.render(<DownloadButton trackId="err-track" />);
    });

    const button = container?.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toContain("Download failed, click to retry");
  });
});
