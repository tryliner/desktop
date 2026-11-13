import { useEffect } from "react";
import { useAppearanceStore } from "../store/appearanceStore";

function readableTextOn(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? "#000000" : "#ffffff";
}

function tint(percent: number): string {
  return `color-mix(in srgb, var(--user-accent) ${percent}%, transparent)`;
}

export function accentVariables(accent: string): Record<string, string> {
  return {
    "--user-accent": accent,
    "--user-accent-text": readableTextOn(accent),
    "--user-accent-icon":
      "color-mix(in srgb, var(--user-accent) 55%, var(--text-primary))",
    "--user-accent-island":
      "color-mix(in srgb, var(--user-accent) 22%, var(--bg-glass))",
    "--accent-primary": accent,
    "--accent-secondary": "color-mix(in srgb, var(--user-accent) 75%, white)",
    "--accent-tertiary": "color-mix(in srgb, var(--user-accent) 55%, white)",
    "--btn-primary-bg": accent,
    "--btn-primary-text": readableTextOn(accent),
    "--fill-subtle": tint(8),
    "--fill": tint(14),
    "--fill-hover": tint(22),
    "--fill-strong": tint(30),
    "--border-white-alpha-14": tint(18),
    "--border-white-alpha-33": tint(32),
    "--glass-prominent-bg": accent,
    "--glass-pill-bg": tint(55),
    "--glass-pill-bg-hover": tint(72),
  };
}

const ACCENT_NAMES = Object.keys(accentVariables("#000000"));

export function useAppearanceSync() {
  const accent = useAppearanceStore((state) => state.accent);
  const uiScale = useAppearanceStore((state) => state.uiScale);

  useEffect(() => {
    const root = document.documentElement;
    ACCENT_NAMES.forEach((name) => root.style.removeProperty(name));
    if (!accent) {
      delete root.dataset.userAccent;
      return;
    }
    root.dataset.userAccent = "on";
    Object.entries(accentVariables(accent)).forEach(([name, value]) =>
      root.style.setProperty(name, value),
    );
  }, [accent]);

  useEffect(() => {
    window.linerElectron?.setZoomFactor?.(uiScale)?.catch(() => undefined);
  }, [uiScale]);
}
