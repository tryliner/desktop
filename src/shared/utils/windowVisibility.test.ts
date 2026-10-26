import { describe, expect, it, vi } from "vitest";
import { applyWindowVisibility, isWindowVisible, onWindowVisibilityChange } from "./windowVisibility";

describe("window visibility", () => {
  it("reports minimize and restore once each and ignores repeats", () => {
    const listener = vi.fn();
    const stop = onWindowVisibilityChange(listener);

    expect(isWindowVisible()).toBe(true);
    applyWindowVisibility(false);
    applyWindowVisibility(false);
    expect(isWindowVisible()).toBe(false);
    applyWindowVisibility(true);

    expect(listener.mock.calls).toEqual([[false], [true]]);
    stop();
    applyWindowVisibility(false);
    expect(listener).toHaveBeenCalledTimes(2);
    applyWindowVisibility(true);
  });

  it("follows the window state from main, where minimized means not visible", async () => {
    vi.resetModules();
    let sendState: (state: { isVisible: boolean }) => void = () => {};
    vi.stubGlobal("linerElectron", {
      onWindowStateChange: (cb: typeof sendState) => {
        sendState = cb;
        return () => {};
      },
    });
    const fresh = await import("./windowVisibility");
    const listener = vi.fn();
    fresh.onWindowVisibilityChange(listener);

    // main sends isVisible: isVisible() && !isMinimized()
    sendState({ isVisible: false });
    expect(fresh.isWindowVisible()).toBe(false);
    sendState({ isVisible: true });
    expect(fresh.isWindowVisible()).toBe(true);
    expect(listener.mock.calls).toEqual([[false], [true]]);
    vi.unstubAllGlobals();
  });
});
