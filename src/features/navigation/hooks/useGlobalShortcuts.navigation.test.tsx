import { describe, it, expect, vi } from "vitest";
import {
  baseOptions,
  mount,
  press,
  playerState,
  playerEngine,
} from "./useGlobalShortcuts.testSetup";

describe("useGlobalShortcuts navigation shortcuts", () => {
  it("F opens Fullscreen Player when closed and a track is loaded, and closes it when open", () => {
    playerState.currentTrack = { id: "track-1" };
    playerState.status = "playing";

    const openFullscreen = vi.fn();
    mount(baseOptions({ fullscreenOpen: false, openFullscreen }));
    press("KeyF");
    expect(openFullscreen).toHaveBeenCalledTimes(1);

    const closeFullscreen = vi.fn();
    mount(baseOptions({ fullscreenOpen: true, closeFullscreen }));
    press("KeyF");
    expect(closeFullscreen).toHaveBeenCalledTimes(1);
  });

  it("F does nothing when no track is loaded/playing", () => {
    playerState.currentTrack = null;
    playerState.status = "idle";

    const openFullscreen = vi.fn();
    mount(baseOptions({ fullscreenOpen: false, openFullscreen }));
    press("KeyF");
    expect(openFullscreen).not.toHaveBeenCalled();
  });

  it("Q opens the queue panel when closed and closes it when open", () => {
    const openRightPanel = vi.fn();
    mount(baseOptions({ rightPanelOpen: false, openRightPanel }));
    press("KeyQ");
    expect(openRightPanel).toHaveBeenCalledTimes(1);
    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
    expect(playerEngine.seek).not.toHaveBeenCalled();

    const closeRightPanel = vi.fn();
    mount(baseOptions({ rightPanelOpen: true, closeRightPanel }));
    press("KeyQ");
    expect(closeRightPanel).toHaveBeenCalledTimes(1);
  });

  it("L does not open the queue panel", () => {
    const openRightPanel = vi.fn();
    mount(baseOptions({ rightPanelOpen: false, openRightPanel }));
    press("KeyL");
    expect(openRightPanel).not.toHaveBeenCalled();
  });
  it("/ opens Search and prevents the character from being typed elsewhere", () => {
    const openSearch = vi.fn();
    mount(baseOptions({ openSearch }));
    const event = press("Slash");
    expect(openSearch).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not open Search while the user is typing (e.g. a literal '/' in a field)", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const openSearch = vi.fn();
    mount(baseOptions({ openSearch }));
    const event = press("Slash", {}, input);

    expect(openSearch).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
