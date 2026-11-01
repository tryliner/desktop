import { describe, it, expect, beforeEach } from "vitest";
import {
  useCustomizationStore,
  getBlockStyle,
  type BlockGlassConfig,
} from "./customizationStore";

describe("customizationStore & getBlockStyle", () => {
  beforeEach(() => {
    useCustomizationStore.getState().resetCustomization();
  });

  it("initializes with default settings", () => {
    const state = useCustomizationStore.getState();
    expect(state.wallpaperUrl).toBe("");
    expect(state.wallpaperBlur).toBe(20);
    expect(state.wallpaperDim).toBe(30);
    expect(state.glassmorphismEnabled).toBe(true);
    expect(state.sidebarBlock.opacity).toBe(70);
    expect(state.contentBlock.opacity).toBe(60);
    expect(state.playerBlock.opacity).toBe(80);
  });

  it("updates wallpaper and block settings correctly", () => {
    const { setWallpaperUrl, setWallpaperBlur, setSidebarBlock } =
      useCustomizationStore.getState();

    setWallpaperUrl("data:image/png;base64,abc");
    setWallpaperBlur(40);
    setSidebarBlock({ opacity: 90, blur: 30 });

    const updated = useCustomizationStore.getState();
    expect(updated.wallpaperUrl).toBe("data:image/png;base64,abc");
    expect(updated.wallpaperBlur).toBe(40);
    expect(updated.sidebarBlock.opacity).toBe(90);
    expect(updated.sidebarBlock.blur).toBe(30);
  });

  it("computes block style for dark and light themes", () => {
    const config: BlockGlassConfig = { opacity: 70, blur: 20, dim: 10 };

    const darkStyle = getBlockStyle(config, true, true, true);
    expect(darkStyle.backgroundColor).toBe("rgba(10, 10, 10, 0.7)");
    expect(darkStyle.backdropFilter).toContain("blur(20px)");
    expect(darkStyle.borderColor).toBeDefined();

    const lightStyle = getBlockStyle(config, false, true, true);
    expect(lightStyle.backgroundColor).toBe("rgba(255, 255, 255, 0.7)");
    expect(lightStyle.backdropFilter).toContain("blur(20px)");

    // When disabled and no custom background, returns empty
    const disabledStyle = getBlockStyle(config, true, false, false);
    expect(disabledStyle).toEqual({});
  });

  it("resets to defaults", () => {
    const { setWallpaperUrl, resetCustomization } =
      useCustomizationStore.getState();

    setWallpaperUrl("https://example.com/image.jpg");
    resetCustomization();

    const state = useCustomizationStore.getState();
    expect(state.wallpaperUrl).toBe("");
    expect(state.wallpaperBlur).toBe(20);
  });

  it("handles missing or partial block glass configs safely", () => {
    // Tests defensive defaults when config properties might be missing
    const fallbackStyle = getBlockStyle({} as any, true, true, true);
    expect(fallbackStyle.backgroundColor).toBe("rgba(10, 10, 10, 1)");
    expect(fallbackStyle.backdropFilter).toBeUndefined();
  });
});
