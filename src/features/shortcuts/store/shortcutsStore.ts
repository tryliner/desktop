import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_SHORTCUTS,
  type ShortcutsSettings,
  type GlobalShortcutsSettings,
  type MainAppShortcutsSettings,
  type MiniplayerShortcutsSettings,
  type ShortcutScope,
} from "../types";
import { normalizeShortcutToEnglish } from "../utils/shortcutMatching";
import { useOverlaySettingsStore } from "@/features/overlay/store/overlaySettingsStore";

interface ShortcutsStoreState extends ShortcutsSettings {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  setGlobalShortcut: (action: keyof GlobalShortcutsSettings, rawShortcut: string) => void;
  setMainAppShortcut: (action: keyof MainAppShortcutsSettings, rawShortcut: string) => void;
  setMiniplayerShortcut: (action: keyof MiniplayerShortcutsSettings, rawShortcut: string) => void;
  resetShortcut: (scope: ShortcutScope, action: string) => void;
  resetSection: (scope: ShortcutScope) => void;
  resetAll: () => void;
}

function notifyElectronGlobalShortcuts(global: GlobalShortcutsSettings) {
  if (typeof window !== "undefined" && window.linerElectron?.updateOverlaySettings) {
    window.linerElectron.updateOverlaySettings({
      shortcut: global.toggleOverlay,
      likeShortcut: global.quickLikeSong,
    });
  }
}

export const useShortcutsStore = create<ShortcutsStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SHORTCUTS,
      isRecording: false,

      setIsRecording: (recording: boolean) => {
        set({ isRecording: recording });
        if (typeof window !== "undefined" && window.linerElectron?.pauseOverlayShortcuts) {
          window.linerElectron.pauseOverlayShortcuts(recording);
        }
      },

      setGlobalShortcut: (action, rawShortcut) => {
        const normalized =
          normalizeShortcutToEnglish(rawShortcut) || DEFAULT_SHORTCUTS.global[action];
        const nextGlobal = {
          ...get().global,
          [action]: normalized,
        };
        set({ global: nextGlobal });
        notifyElectronGlobalShortcuts(nextGlobal);

        // Keep legacy overlay store in sync for toggleOverlay
        if (action === "toggleOverlay") {
          useOverlaySettingsStore.setState({ shortcut: normalized });
        }
      },

      setMainAppShortcut: (action, rawShortcut) => {
        const normalized =
          normalizeShortcutToEnglish(rawShortcut) || DEFAULT_SHORTCUTS.mainApp[action];
        set({
          mainApp: {
            ...get().mainApp,
            [action]: normalized,
          },
        });
      },

      setMiniplayerShortcut: (action, rawShortcut) => {
        const normalized =
          normalizeShortcutToEnglish(rawShortcut) || DEFAULT_SHORTCUTS.miniplayer[action];
        set({
          miniplayer: {
            ...get().miniplayer,
            [action]: normalized,
          },
        });
      },

      resetShortcut: (scope, action) => {
        if (scope === "global" && action in DEFAULT_SHORTCUTS.global) {
          const act = action as keyof GlobalShortcutsSettings;
          get().setGlobalShortcut(act, DEFAULT_SHORTCUTS.global[act]);
        } else if (scope === "mainApp" && action in DEFAULT_SHORTCUTS.mainApp) {
          const act = action as keyof MainAppShortcutsSettings;
          get().setMainAppShortcut(act, DEFAULT_SHORTCUTS.mainApp[act]);
        } else if (scope === "miniplayer" && action in DEFAULT_SHORTCUTS.miniplayer) {
          const act = action as keyof MiniplayerShortcutsSettings;
          get().setMiniplayerShortcut(act, DEFAULT_SHORTCUTS.miniplayer[act]);
        }
      },

      resetSection: (scope) => {
        if (scope === "global") {
          const next = { ...DEFAULT_SHORTCUTS.global };
          set({ global: next });
          notifyElectronGlobalShortcuts(next);
          useOverlaySettingsStore.setState({ shortcut: next.toggleOverlay });
        } else if (scope === "mainApp") {
          set({ mainApp: { ...DEFAULT_SHORTCUTS.mainApp } });
        } else if (scope === "miniplayer") {
          set({ miniplayer: { ...DEFAULT_SHORTCUTS.miniplayer } });
        }
      },

      resetAll: () => {
        set({
          global: { ...DEFAULT_SHORTCUTS.global },
          mainApp: { ...DEFAULT_SHORTCUTS.mainApp },
          miniplayer: { ...DEFAULT_SHORTCUTS.miniplayer },
        });
        notifyElectronGlobalShortcuts(DEFAULT_SHORTCUTS.global);
        useOverlaySettingsStore.setState({ shortcut: DEFAULT_SHORTCUTS.global.toggleOverlay });
      },
    }),
    {
      name: "liner_shortcuts_settings_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        global: state.global,
        mainApp: state.mainApp,
        miniplayer: state.miniplayer,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Ensure newly added actions have defaults
        state.global = {
          ...DEFAULT_SHORTCUTS.global,
          ...(state.global || {}),
        };
        state.mainApp = {
          ...DEFAULT_SHORTCUTS.mainApp,
          ...(state.mainApp || {}),
        };
        state.miniplayer = {
          ...DEFAULT_SHORTCUTS.miniplayer,
          ...(state.miniplayer || {}),
        };

        // Normalize all rehydrated shortcuts
        for (const key of Object.keys(state.global) as (keyof GlobalShortcutsSettings)[]) {
          state.global[key] =
            normalizeShortcutToEnglish(state.global[key]) || DEFAULT_SHORTCUTS.global[key];
        }
        for (const key of Object.keys(state.mainApp) as (keyof MainAppShortcutsSettings)[]) {
          state.mainApp[key] =
            normalizeShortcutToEnglish(state.mainApp[key]) || DEFAULT_SHORTCUTS.mainApp[key];
        }
        for (const key of Object.keys(state.miniplayer) as (keyof MiniplayerShortcutsSettings)[]) {
          state.miniplayer[key] =
            normalizeShortcutToEnglish(state.miniplayer[key]) || DEFAULT_SHORTCUTS.miniplayer[key];
        }

        notifyElectronGlobalShortcuts(state.global);
      },
    }
  )
);
