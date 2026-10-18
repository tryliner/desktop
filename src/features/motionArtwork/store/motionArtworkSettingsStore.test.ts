import { describe, it, expect, beforeEach } from "vitest";
import { useMotionArtworkSettingsStore } from "./motionArtworkSettingsStore";

describe("motionArtworkSettingsStore", () => {
  beforeEach(() => {
    useMotionArtworkSettingsStore.getState().setEnabled(false);
  });

  it("starts disabled by default", () => {
    expect(useMotionArtworkSettingsStore.getState().enabled).toBe(false);
  });

  it("toggles the feature", () => {
    useMotionArtworkSettingsStore.getState().setEnabled(true);
    expect(useMotionArtworkSettingsStore.getState().enabled).toBe(true);

    useMotionArtworkSettingsStore.getState().setEnabled(false);
    expect(useMotionArtworkSettingsStore.getState().enabled).toBe(false);
  });
});
