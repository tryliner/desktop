import { useEffect } from "react";
import { useTheme } from "next-themes";
import logo from "@/assets/logo.svg";
import { APP_ICON_SIZE, drawAppIconArtwork } from "./appIconArtwork";

async function renderIconDataUrl(isLight: boolean): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = APP_ICON_SIZE;
  canvas.height = APP_ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load logo for icon"));
    img.src = logo;
  });

  drawAppIconArtwork(ctx, img, isLight);
  return canvas.toDataURL("image/png");
}

export function useAppIconSync() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const isLight = (resolvedTheme || theme) === "light";
    let active = true;

    void renderIconDataUrl(isLight).then((dataUrl) => {
      if (!active || !dataUrl) return;

      if (window.linerElectron?.setAppIcon) {
        window.linerElectron.setAppIcon(dataUrl, {
          isDefault: true,
        });
      }

      let favicon =
        document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = dataUrl;
    });

    return () => {
      active = false;
    };
  }, [theme, resolvedTheme]);
}
