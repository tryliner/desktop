import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import {
  DEFAULT_MOTION_ARTWORK_SETTINGS,
  type MotionArtworkSettings,
} from "../contracts";

interface MotionArtworkSettingsState extends MotionArtworkSettings {
  setEnabled: (enabled: boolean) => void;
}

// Renderer-only preference: the main process never needs the flag because the
// renderer only asks for a canvas when the feature is enabled.
export const useMotionArtworkSettingsStore = create<MotionArtworkSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_MOTION_ARTWORK_SETTINGS,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: "liner_motion_artwork_settings_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state): MotionArtworkSettings => ({
        enabled: state.enabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (typeof state.enabled !== "boolean") {
          state.setEnabled(DEFAULT_MOTION_ARTWORK_SETTINGS.enabled);
        }
      },
    },
  ),
);
