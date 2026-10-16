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
});
