import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type VisualMode = "full" | "balanced" | "lite";

export const VISUAL_MODES: VisualMode[] = ["full", "balanced", "lite"];

export interface VisualModeState {
  mode: VisualMode;
  ambientAvailable: boolean;
  setMode: (mode: VisualMode) => void;
  setAmbientAvailable: (available: boolean) => void;
}

export const useVisualModeStore = create<VisualModeState>()(
  persist(
    (set) => ({
      mode: "full",
      ambientAvailable: false,
      setMode: (mode) => set({ mode }),
      setAmbientAvailable: (ambientAvailable) => set({ ambientAvailable }),
    }),
    {
      name: "liner_visual_mode",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);

export const useAmbientEnabled = () =>
  useVisualModeStore((s) => s.mode !== "lite");

export const useLyricsEdgeFade = () =>
  useVisualModeStore((s) => s.mode !== "lite");

export const useLyricsEdgeBlur = () =>
  useVisualModeStore((s) => s.mode === "full");

export const useKawarpEnabled = () =>
  useVisualModeStore((s) => s.mode !== "lite");

export const useGlassBlur = () => useVisualModeStore((s) => s.mode === "full");
