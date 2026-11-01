import { describe, it, expect, beforeEach } from "vitest";
import { useSleepTimerStore } from "./store/sleepTimerStore";
import { formatRemainingTime } from "./hooks/useSleepTimer";

describe("Sleep Timer Store & Logic", () => {
  beforeEach(() => {
    useSleepTimerStore.getState().cancelTimer();
  });

  it("initializes with inactive state", () => {
    const state = useSleepTimerStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.mode).toBe("off");
    expect(state.remainingSeconds).toBe(0);
  });

  it("starts a 15-minute timer correctly", () => {
    useSleepTimerStore.getState().startTimer("15", 15, 0.8);
    const state = useSleepTimerStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.mode).toBe("15");
    expect(state.remainingSeconds).toBe(900);
    expect(state.originalVolume).toBe(0.8);
    expect(state.isFadingOut).toBe(false);
  });

  it("handles custom minute duration", () => {
    useSleepTimerStore.getState().startTimer("custom", 25, 0.5);
    const state = useSleepTimerStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.mode).toBe("custom");
    expect(state.remainingSeconds).toBe(1500);
  });

  it("activates fade out in the last 60 seconds", () => {
    useSleepTimerStore.getState().startTimer("custom", 1);
    expect(useSleepTimerStore.getState().remainingSeconds).toBe(60);

    useSleepTimerStore.getState().tick();
    const state = useSleepTimerStore.getState();
    expect(state.remainingSeconds).toBe(59);
    expect(state.isFadingOut).toBe(true);
  });

  it("cancels timer and resets state cleanly", () => {
    useSleepTimerStore.getState().startTimer("30");
    expect(useSleepTimerStore.getState().isActive).toBe(true);

    useSleepTimerStore.getState().cancelTimer();
    const state = useSleepTimerStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.mode).toBe("off");
    expect(state.remainingSeconds).toBe(0);
  });

  it("formats remaining seconds into mm:ss string", () => {
    expect(formatRemainingTime(65)).toBe("1:05");
    expect(formatRemainingTime(900)).toBe("15:00");
    expect(formatRemainingTime(9)).toBe("0:09");
  });
});
