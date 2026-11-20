import { useEffect } from "react";
import { useAppearanceStore } from "./appearanceStore";
import { importLegacyWallpaper } from "./legacyWallpaper";
import { glassVars, rootVarsCss } from "./wallpaperCss";

const STYLE_ID = "liner-appearance";
const GLASS_BLUR_PX = 28;

function writeStyle(css: string) {
  let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_ID;
    document.head.appendChild(tag);
  }
  if (tag.textContent !== css) tag.textContent = css;
}

export function useAppearanceCss() {
  const hasWallpaper = useAppearanceStore((s) => Boolean(s.wallpaperKey));
  const surfaceOpacity = useAppearanceStore((s) => s.surfaceOpacity);

  useEffect(() => {
    writeStyle(
      hasWallpaper
        ? rootVarsCss({
            dark: glassVars(surfaceOpacity, GLASS_BLUR_PX, true),
            light: glassVars(surfaceOpacity, GLASS_BLUR_PX, false),
          })
        : "",
    );
    document.documentElement.toggleAttribute("data-wallpaper", hasWallpaper);
  }, [hasWallpaper, surfaceOpacity]);

  useEffect(() => {
    void importLegacyWallpaper();
  }, []);

  useEffect(
    () => () => {
      document.getElementById(STYLE_ID)?.remove();
      document.documentElement.removeAttribute("data-wallpaper");
    },
    [],
  );
}
