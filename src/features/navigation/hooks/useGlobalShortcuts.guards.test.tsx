import { describe, it, expect, vi } from "vitest";
import {
  baseOptions,
  mount,
  press,
  playerEngine,
} from "./useGlobalShortcuts.testSetup";

describe("useGlobalShortcuts shortcut guards", () => {
  it("does not toggle Play/Pause while typing in an input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    mount(baseOptions());
    const event = press("Space", {}, input);

    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
  it("lets a focused volume slider (role=slider) handle arrow keys instead of the global shortcut", () => {
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    document.body.appendChild(slider);

    mount(baseOptions());
    const event = press("ArrowUp", {}, slider);

    expect(playerEngine.setVolume).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets a focused button consume Space without toggling playback", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);

    mount(baseOptions());
    const event = press("Space", {}, button);

    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores shortcuts combined with Ctrl/Cmd/Alt so browser shortcuts keep working", () => {
    mount(baseOptions({ openFullscreen: vi.fn() }));

    const ctrlF = press("KeyF", { ctrlKey: true });
    expect(ctrlF.defaultPrevented).toBe(false);

    const altLeft = press("ArrowLeft", { altKey: true });
    expect(altLeft.defaultPrevented).toBe(false);
    expect(playerEngine.seek).not.toHaveBeenCalled();
  });

  it("ignores shortcuts while a dialog is open", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("data-dialog-container", "true");
    document.body.appendChild(dialog);

    mount(baseOptions());
    press("Space");
    press("KeyF");

    expect(playerEngine.togglePlayPause).not.toHaveBeenCalled();
  });
});
