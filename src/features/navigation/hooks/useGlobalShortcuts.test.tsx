import { describe, it, expect } from "vitest";
import {
  baseOptions,
  mount,
  press,
  playerState,
  playerEngine,
} from "./useGlobalShortcuts.testSetup";

describe("useGlobalShortcuts playback shortcuts", () => {
  it("Space toggles play/pause and prevents the default page scroll", () => {
    mount(baseOptions());
    const event = press("Space");
    expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
  it("M mutes and restores the previous volume level on toggle", () => {
    playerState.volume = 0.65;
    mount(baseOptions());

    press("KeyM");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0);

    press("KeyM");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0.65);
  });
  it("seeks 5s backward and forward, clamped to [0, duration]", () => {
    playerState.positionMs = 10_000;
    playerState.durationMs = 60_000;
    mount(baseOptions());

    press("ArrowRight");
    expect(playerEngine.seek).toHaveBeenLastCalledWith(15_000);

    playerState.positionMs = 15_000;
    press("ArrowLeft");
    expect(playerEngine.seek).toHaveBeenLastCalledWith(10_000);
  });

  it("does not seek before 0:00", () => {
    playerState.positionMs = 2_000;
    mount(baseOptions());
    press("ArrowLeft");
    expect(playerEngine.seek).toHaveBeenLastCalledWith(0);
  });

  it("adjusts volume by 5%, clamped to [0, 1]", () => {
    playerState.volume = 0.6;
    mount(baseOptions());

    press("ArrowUp");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0.65);

    playerState.volume = 0.6;
    press("ArrowDown");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(0.55);

    playerState.volume = 0.98;
    press("ArrowUp");
    expect(playerEngine.setVolume).toHaveBeenLastCalledWith(1);
  });
  it("does not fire the toggle shortcuts repeatedly while a key is held", () => {
    mount(baseOptions());
    press("Space", { repeat: false });
    press("Space", { repeat: true });
    expect(playerEngine.togglePlayPause).toHaveBeenCalledTimes(1);
  });

  it("still allows held arrow keys to keep seeking/adjusting volume", () => {
    mount(baseOptions());
    press("ArrowRight", { repeat: true });
    expect(playerEngine.seek).toHaveBeenCalledTimes(1);
  });
});
