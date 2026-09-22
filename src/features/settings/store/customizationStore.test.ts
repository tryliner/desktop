import { describe, it, expect, beforeEach } from "vitest";
import {
  useCustomizationStore,
  clampBlockConfig,
  getBlockStyle,
  isGlassThemeActive,
  MIN_OPACITY,
  MAX_OPACITY,
  MIN_BLUR,
  MAX_BLUR,
  MIN_DIM,
  MAX_DIM,
} from "./customizationStore";

describe("customizationStore", () => {
  beforeEach(() => {
    useCustomizationStore.getState().resetAll();
  });

  it("clamps block values within safe limits", () => {
    const clampedUnder = clampBlockConfig({ opacity: 5, blur: -10, dim: -5 });
    expect(clampedUnder.opacity).toBe(25);
    expect(clampedUnder.blur).toBe(10);
    expect(clampedUnder.dim).toBe(8);

    const clampedOver = clampBlockConfig({ opacity: 150, blur: 100, dim: 200 });
    expect(clampedOver.opacity).toBe(100);
    expect(clampedOver.blur).toBe(40);
    expect(clampedOver.dim).toBe(85);
  });

  it("updates and resets logic blocks individually", () => {
    const store = useCustomizationStore.getState();
    store.setBlockConfig("sidebar", { opacity: 50, blur: 15, dim: 10 });
    store.setBlockConfig("contentView", { opacity: 60, blur: 20, dim: 25 });

    let state = useCustomizationStore.getState();
    expect(state.sidebar.opacity).toBe(50);
    expect(state.sidebar.blur).toBe(15);
    expect(state.sidebar.dim).toBe(10);
    expect(state.contentView.opacity).toBe(60);

    store.resetBlock("sidebar");
    state = useCustomizationStore.getState();
    expect(state.sidebar.opacity).toBe(100);
    expect(state.sidebar.blur).toBe(0);
    expect(state.contentView.opacity).toBe(60);
  });

  it("applies one block configuration to all blocks", () => {
    const store = useCustomizationStore.getState();
    store.setBlockConfig("sidebar", { opacity: 45, blur: 28, dim: 35 });
    store.applyToAllBlocks("sidebar");

    const state = useCustomizationStore.getState();
    expect(state.sidebar).toEqual({ opacity: 45, blur: 28, dim: 35 });
    expect(state.contentView).toEqual({ opacity: 45, blur: 28, dim: 35 });
    expect(state.miniplayer).toEqual({ opacity: 45, blur: 28, dim: 35 });
  });

  it("calculates composite glassmorphism block style accurately", () => {
    const withoutBg = getBlockStyle({ opacity: 50, blur: 15, dim: 20 }, true, false);
    expect(withoutBg).toEqual({});

    const defaultWithBg = getBlockStyle({ opacity: 100, blur: 0, dim: 0 }, true, true);
    expect(defaultWithBg.background).toBe("var(--color-bg-primary, #0a0a0a)");

    const darkGlass = getBlockStyle({ opacity: 70, blur: 18, dim: 20 }, true, true);
    expect(darkGlass.backdropFilter).toBe("blur(18px)");
    expect(darkGlass.background).toContain("rgba(0, 0, 0, 0.2)");
    expect(darkGlass.background).toContain("rgba(10, 10, 10, 0.7)");

    const lightGlass = getBlockStyle({ opacity: 50, blur: 12, dim: 0 }, false, true);
    expect(lightGlass).toEqual({});
  });

  it("scales glass transparency progressively as opacity decreases", () => {
    const styleHighOpacity = getBlockStyle({ opacity: 90, blur: 10, dim: 10 }, true, true);
    const styleLowOpacity = getBlockStyle({ opacity: 25, blur: 25, dim: 10 }, true, true);

    expect((styleHighOpacity as Record<string, string>)["--glass-pill-bg"]).toBeDefined();
    expect((styleLowOpacity as Record<string, string>)["--glass-pill-bg"]).toBeDefined();
    expect((styleHighOpacity as Record<string, string>)["--glass-pill-bg"]).not.toEqual(
      (styleLowOpacity as Record<string, string>)["--glass-pill-bg"]
    );
    expect((styleLowOpacity as Record<string, string>)["--glass-pill-border"]).toBe("none");
  });

  it("determines when glass theme is active with custom wallpaper and transparent blur", () => {
    const store = useCustomizationStore.getState();

    // without wallpaper, glass is not active
    expect(isGlassThemeActive(store)).toBe(false);

    // adding wallpaper activates default glass preset
    store.setBackgroundImage("data:image/png;base64,mock");
    expect(isGlassThemeActive(useCustomizationStore.getState())).toBe(true);

    // if all blocks are opaque, glass is inactive
    store.setBlockConfig("sidebar", { opacity: 100, blur: 0 });
    store.setBlockConfig("contentView", { opacity: 100, blur: 0 });
    store.setBlockConfig("miniplayer", { opacity: 100, blur: 0 });
    expect(isGlassThemeActive(useCustomizationStore.getState())).toBe(false);

    // if only one block has transparency and blur, glass is active
    store.setBlockConfig("contentView", { opacity: 70, blur: 15 });
    expect(isGlassThemeActive(useCustomizationStore.getState())).toBe(true);

    // resetting all clears wallpaper and deactivates glass
    store.resetAll();
    expect(isGlassThemeActive(useCustomizationStore.getState())).toBe(false);
  });
});
