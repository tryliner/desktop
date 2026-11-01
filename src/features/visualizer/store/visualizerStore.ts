import { create } from "zustand";
import { persist } from "zustand/middleware";

export type VisualizerMode = "off" | "bars" | "wave";

export interface VisualizerState {
  mode: VisualizerMode;
  setMode: (mode: VisualizerMode) => void;
  toggleMode: () => void;
}

export const useVisualizerStore = create<VisualizerState>()(
  persist(
    (set) => ({
      mode: "bars",
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set((s) => ({
          mode:
            s.mode === "bars"
              ? "wave"
              : s.mode === "wave"
                ? "off"
                : "bars",
        })),
    }),
    {
      name: "liner_visualizer_v1",
    },
  ),
);
