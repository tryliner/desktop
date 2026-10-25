import { useEffect } from "react";
import { useTheme } from "next-themes";
import logo from "@/assets/logo.svg";

async function renderIconDataUrl(isLight: boolean): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(0, 0, 512, 512, 112);
  } else {
    ctx.rect(0, 0, 512, 512);
  }
  ctx.fillStyle = isLight ? "#f5f5f7" : "#0d0d10";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = isLight
    ? "rgba(0, 0, 0, 0.08)"
    : "rgba(255, 255, 255, 0.08)";
  ctx.stroke();

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load logo for icon"));
    img.src = logo;
  });

  if (isLight) {
    ctx.filter = "invert(1)";
  }

  ctx.drawImage(img, 112, 144, 288, 224);
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
