import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { SyncedLyricsView } from "./SyncedLyricsView";
import type { SyncedLrcLine } from "@/shared/contracts/lyrics";

// @ts-expect-error - act support flag in vitest browserless DOM environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SyncedLyricsView Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const mockLines: SyncedLrcLine[] = [
    { id: "line_0", timeMs: 5000, text: "First verse line" },
    { id: "line_1", timeMs: 12000, text: "Second verse line" },
    { id: "line_2", timeMs: 24000, text: "Chorus explodes here" },
  ];

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

  it("renders empty state when no lines are provided", () => {
    act(() => {
      root?.render(<SyncedLyricsView lines={[]} />);
    });

    const empty = container?.querySelector('[data-testid="synced-lyrics-empty"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain("No synced lyrics available");
  });

  it("renders lines and marks active line based on currentPositionMs", () => {
    act(() => {
      root?.render(<SyncedLyricsView lines={mockLines} currentPositionMs={15000} />);
    });

    const view = container?.querySelector('[data-testid="synced-lyrics-view"]');
    expect(view).not.toBeNull();

    const line0 = container?.querySelector('[data-testid="lyric-line-0"]');
    const line1 = container?.querySelector('[data-testid="lyric-line-1"]');
    const line2 = container?.querySelector('[data-testid="lyric-line-2"]');

    expect(line0?.getAttribute("data-active")).toBeNull();
    expect(line1?.getAttribute("data-active")).toBe("true");
    expect(line2?.getAttribute("data-active")).toBeNull();
  });

  it("handles line click and triggers onSeek with line timeMs", () => {
    const handleSeek = vi.fn();
    act(() => {
      root?.render(
        <SyncedLyricsView
          lines={mockLines}
          currentPositionMs={5000}
          onSeek={handleSeek}
        />
      );
    });

    const line2 = container?.querySelector('[data-testid="lyric-line-2"]') as HTMLElement;
    expect(line2).not.toBeNull();

    act(() => {
      line2.click();
    });

    expect(handleSeek).toHaveBeenCalledWith(24000);
  });

  it("activates manual scroll override on wheel event and exposes sync button", () => {
    act(() => {
      root?.render(<SyncedLyricsView lines={mockLines} currentPositionMs={6000} />);
    });

    let syncBtn = container?.querySelector('[data-testid="sync-lyrics-button"]');
    expect(syncBtn).toBeNull();

    const scrollRegion = container?.querySelector('[role="region"]') as HTMLElement;
    expect(scrollRegion).not.toBeNull();

    // Trigger wheel event
    act(() => {
      scrollRegion.dispatchEvent(new Event("wheel", { bubbles: true }));
    });

    const buttonEl = container?.querySelector<HTMLButtonElement>('[data-testid="sync-lyrics-button"]');
    expect(buttonEl).not.toBeNull();
    expect(buttonEl?.textContent).toContain("Sync lyrics");

    // Click sync button to restore following mode
    act(() => {
      buttonEl?.click();
    });

    const resetBtn = container?.querySelector('[data-testid="sync-lyrics-button"]');
    expect(resetBtn).toBeNull();
  });
});
