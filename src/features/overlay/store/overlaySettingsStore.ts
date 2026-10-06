import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OverlayPosition, OverlaySettings } from "../contracts";

interface OverlaySettingsState extends OverlaySettings {
  setEnabled: (enabled: boolean) => void;
  setPosition: (position: OverlayPosition) => void;
  setShortcut: (shortcut: string) => void;
  setAutoShowOnMinimize: (autoShowOnMinimize: boolean) => void;
  setAlwaysOnTop: (alwaysOnTop: boolean) => void;
}

const DEFAULT_SETTINGS: OverlaySettings = {
  enabled: true,
  position: "top-center",
  shortcut: "Alt+Shift+O",
  autoShowOnMinimize: true,
  alwaysOnTop: true,
};

function notifyElectron(patch: Partial<OverlaySettings>) {
  if (typeof window !== "undefined" && window.linerElectron?.updateOverlaySettings) {
    window.linerElectron.updateOverlaySettings(patch);
  }
}

export const useOverlaySettingsStore = create<OverlaySettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setEnabled: (enabled) => {
        set({ enabled });
        notifyElectron({ enabled });
      },
      setPosition: (position) => {
        set({ position });
        notifyElectron({ position });
      },
      setShortcut: (shortcut) => {
        set({ shortcut });
        notifyElectron({ shortcut });
      },
      setAutoShowOnMinimize: (autoShowOnMinimize) => {
        set({ autoShowOnMinimize });
        notifyElectron({ autoShowOnMinimize });
      },
      setAlwaysOnTop: (alwaysOnTop) => {
        set({ alwaysOnTop });
        notifyElectron({ alwaysOnTop });
      },
    }),
    {
      name: "liner_overlay_settings_v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
