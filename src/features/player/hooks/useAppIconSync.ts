import { useEffect } from "react";
import { useTheme } from "next-themes";
import { usePlayerStore, type AccentVariant } from "../store/playerStore";
import defaultLogo from "@/assets/branding/logo-default.svg";
import spotifyLogo from "@/assets/branding/logo-spotify.svg";
import discordLogo from "@/assets/branding/logo-discord.svg";
import telegramLogo from "@/assets/branding/logo-telegram.svg";
import auroraLogo from "@/assets/branding/logo-aurora.svg";
import sunsetLogo from "@/assets/branding/logo-sunset.svg";
import oceanLogo from "@/assets/branding/logo-ocean.svg";
import forestLogo from "@/assets/branding/logo-forest.svg";
import berryLogo from "@/assets/branding/logo-berry.svg";
import carbonLogo from "@/assets/branding/logo-carbon.svg";
import pixelLogo from "@/assets/branding/logo-pixel.svg";
import scanlinesLogo from "@/assets/branding/logo-scanlines.svg";
import vhsLogo from "@/assets/branding/logo-vhs.svg";

const brandingLogos: Record<AccentVariant, string> = {
  default: defaultLogo,
  spotify: spotifyLogo,
  discord: discordLogo,
  telegram: telegramLogo,
  aurora: auroraLogo,
  sunset: sunsetLogo,
  ocean: oceanLogo,
  forest: forestLogo,
  berry: berryLogo,
  carbon: carbonLogo,
  pixel: pixelLogo,
  scanlines: scanlinesLogo,
  vhs: vhsLogo,
};

const invertedLightVariants: readonly AccentVariant[] = [
  "default",
  "carbon",
  "pixel",
  "scanlines",
];

async function renderIconDataUrl(
  logoSrc: string,
  isLight: boolean,
  shouldInvert: boolean,
): Promise<string> {
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
  ctx.fillStyle = isLight ? "#ffffff" : "#0d0d10";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";
  ctx.stroke();

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load branding logo for icon"));
    img.src = logoSrc;
  });

  if (isLight && shouldInvert) {
    ctx.filter = "invert(1)";
  }

  ctx.drawImage(img, 128.7, 107.8, 254.6, 296.4);
  return canvas.toDataURL("image/png");
}

export function useAppIconSync() {
  const accentVariant = usePlayerStore((state) => state.accentVariant);
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const isLight = (resolvedTheme || theme) === "light";
    const shouldInvert = invertedLightVariants.includes(accentVariant);
    const logoSrc = brandingLogos[accentVariant] || defaultLogo;
    let active = true;

    void renderIconDataUrl(logoSrc, isLight, shouldInvert).then((dataUrl) => {
      if (!active || !dataUrl) return;

      if (window.linerElectron?.setAppIcon) {
        window.linerElectron.setAppIcon(dataUrl);
      }

      let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
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
  }, [accentVariant, theme, resolvedTheme]);
}
