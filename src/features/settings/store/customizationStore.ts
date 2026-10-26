import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useTheme } from "next-themes";
import { debouncedStorage } from "@/shared/utils/storage";
import { usePageBackdropStore } from "@/shared/lib";

export interface CustomizationState {
  coverGlow: boolean;
  setCoverGlow: (enabled: boolean) => void;
}

export const useCustomizationStore = create<CustomizationState>()(
  persist(
    (set) => ({
      coverGlow: true,
      setCoverGlow: (enabled) => set({ coverGlow: enabled }),
    }),
    {
      name: "liner_customization_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({ coverGlow: state.coverGlow }),
    },
  ),
);

function getIsDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function useIsDarkTheme(): boolean {
  const { resolvedTheme } = useTheme();
  return resolvedTheme ? resolvedTheme === "dark" : getIsDarkTheme();
}

export function useEffectiveCoverGlow(): boolean {
  const coverGlow = useCustomizationStore((s) => s.coverGlow);
  const isDark = useIsDarkTheme();
  return coverGlow && isDark;
}

export function useHasPageBackdrop(): boolean {
  const coverGlow = useEffectiveCoverGlow();
  const hasCover = usePageBackdropStore((s) => Boolean(s.coverUrl));
  return coverGlow && hasCover;
}

export function useClassicSurfaces(): boolean {
  return !useEffectiveCoverGlow();
}
