import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface MiniPlayerSettingsState {
  autoShowOnMinimize: boolean;
  showTimeline: boolean;
  closeOnRestore: boolean;
  alwaysOnTop: boolean;
  applyCustomBackground: boolean;

  setAutoShowOnMinimize: (value: boolean) => void;
  setShowTimeline: (value: boolean) => void;
  setCloseOnRestore: (value: boolean) => void;
  setAlwaysOnTop: (value: boolean) => void;
  setApplyCustomBackground: (value: boolean) => void;
}

function syncElectronSettings(patch: {
  autoShowOnMinimize?: boolean;
  closeOnRestore?: boolean;
  alwaysOnTop?: boolean;
}) {
  if (typeof window !== "undefined" && window.linerElectron?.updateTouchBarSettings) {
    window.linerElectron.updateTouchBarSettings(patch);
  }
}

export const useMiniPlayerSettingsStore = create<MiniPlayerSettingsState>()(
  persist(
    (set, get) => ({
      autoShowOnMinimize: true,
      showTimeline: true,
      closeOnRestore: true,
      alwaysOnTop: true,
      applyCustomBackground: true,

      setAutoShowOnMinimize: (value) => {
        set({ autoShowOnMinimize: value });
        syncElectronSettings({ autoShowOnMinimize: value });
      },

      setShowTimeline: (value) => {
        set({ showTimeline: value });
      },

      setCloseOnRestore: (value) => {
        set({ closeOnRestore: value });
        syncElectronSettings({ closeOnRestore: value });
      },

      setAlwaysOnTop: (value) => {
        set({ alwaysOnTop: value });
        syncElectronSettings({ alwaysOnTop: value });
      },

      setApplyCustomBackground: (value) => {
        set({ applyCustomBackground: value });
      },
    }),
    {
      name: "liner_miniplayer_settings_v1",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        syncElectronSettings({
          autoShowOnMinimize: state.autoShowOnMinimize,
          closeOnRestore: state.closeOnRestore,
          alwaysOnTop: state.alwaysOnTop,
        });
      },
    },
  ),
);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "liner_miniplayer_settings_v1" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.state) {
          useMiniPlayerSettingsStore.setState(parsed.state);
        }
      } catch {}
    }
  });

  if (window.linerElectron?.onTouchBarSettingsChanged) {
    window.linerElectron.onTouchBarSettingsChanged((patch: any) => {
      if (patch && typeof patch === "object") {
        useMiniPlayerSettingsStore.setState(patch);
      }
    });
  }
}
