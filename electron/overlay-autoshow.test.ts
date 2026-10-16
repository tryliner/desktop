import { describe, expect, it } from "vitest";
import { shouldShowOnBackground, type BackgroundCheck } from "./overlay-autoshow";

const altTabbed: BackgroundCheck = {
  enabled: true,
  autoShow: true,
  mainMinimized: false,
  mainVisible: true,
  mainFocused: false,
  appWindowFocused: false,
  overlayShown: false,
};

describe("shouldShowOnBackground", () => {
  it("shows the overlay when another app takes focus", () => {
    expect(shouldShowOnBackground(altTabbed)).toBe(true);
  });

  it("respects the overlay and auto-show settings", () => {
    expect(shouldShowOnBackground({ ...altTabbed, enabled: false })).toBe(false);
    expect(shouldShowOnBackground({ ...altTabbed, autoShow: false })).toBe(false);
  });

  it("leaves minimize to the minimize handler", () => {
    expect(shouldShowOnBackground({ ...altTabbed, mainMinimized: true })).toBe(false);
    expect(shouldShowOnBackground({ ...altTabbed, mainVisible: false })).toBe(false);
  });

  it("does nothing when focus stays in Liner", () => {
    expect(shouldShowOnBackground({ ...altTabbed, mainFocused: true })).toBe(false);
    expect(shouldShowOnBackground({ ...altTabbed, appWindowFocused: true })).toBe(false);
  });

  it("does not take over an overlay opened by hand", () => {
    expect(shouldShowOnBackground({ ...altTabbed, overlayShown: true })).toBe(false);
  });
});
