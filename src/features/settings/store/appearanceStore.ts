import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type SidebarPosition = "left" | "top";

export const MIN_UI_SCALE = 0.8;
export const MAX_UI_SCALE = 1.5;
export const ACCENT_PRESETS = [
  "#8b5cf6",
  "#3b82f6",
  "#14b8a6",
  "#22c55e",
  "#f97316",
  "#ec4899",
] as const;

interface AppearanceState {
  uiScale: number;
  accent: string | null;
  sidebarPosition: SidebarPosition;
  backgroundVersion: number;
  backgroundDim: number;
  backgroundBlur: number;
  setUiScale: (value: number) => void;
  setAccent: (value: string | null) => void;
  setSidebarPosition: (value: SidebarPosition) => void;
  bumpBackgroundVersion: () => void;
  resetBackgroundVersion: () => void;
  setBackgroundDim: (value: number) => void;
  setBackgroundBlur: (value: number) => void;
}

export function clampUiScale(value: number): number {
  const clamped = Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, value));
  return Math.round(clamped * 10) / 10;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      uiScale: 1,
      accent: null,
      sidebarPosition: "left",
      backgroundVersion: 0,
      backgroundDim: 35,
      backgroundBlur: 0,
      setUiScale: (value) => set({ uiScale: clampUiScale(value) }),
      setAccent: (value) => set({ accent: isHexColor(value) ? value : null }),
      setSidebarPosition: (sidebarPosition) =>
        set({ sidebarPosition: sidebarPosition === "top" ? "top" : "left" }),
      bumpBackgroundVersion: () =>
        set((state) => ({ backgroundVersion: state.backgroundVersion + 1 })),
      resetBackgroundVersion: () => set({ backgroundVersion: 0 }),
      setBackgroundDim: (value) =>
        set({ backgroundDim: Math.min(80, Math.max(0, Math.round(value))) }),
      setBackgroundBlur: (value) =>
        set({ backgroundBlur: Math.min(30, Math.max(0, Math.round(value))) }),
    }),
    {
      name: "liner_appearance_v1",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppearanceState>;
        return {
          ...current,
          ...saved,
          sidebarPosition: saved.sidebarPosition === "top" ? "top" : "left",
        };
      },
    },
  ),
);
