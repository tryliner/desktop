import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_SHORTCUTS,
  OPTIONAL_GLOBAL_ACTIONS,
  type ShortcutsSettings,
  type GlobalShortcutsSettings,
  type MainAppShortcutsSettings,
  type MiniplayerShortcutsSettings,
  type ShortcutScope,
} from "../types";
import { normalizeShortcutToEnglish } from "../utils/shortcutMatching";
import {
  DEFAULT_VOLUME_STEP,
  isVolumeStep,
  type VolumeStep,
} from "../utils/volumeStep";
import { useOverlaySettingsStore } from "@/features/overlay/store/overlaySettingsStore";

export type GlobalShortcutState = "ok" | "taken" | "invalid";
export type GlobalShortcutStatusMap = Partial<
  Record<keyof GlobalShortcutsSettings, GlobalShortcutState>
>;

export interface RejectedGlobalShortcut {
  action: keyof GlobalShortcutsSettings;
  shortcut: string;
  reason: Exclude<GlobalShortcutState, "ok">;
}

interface PendingGlobalEdit {
  action: keyof GlobalShortcutsSettings;
  previous: string;
  at: number;
  cleared: boolean;
}

export const GLOBAL_EDIT_VERDICT_WINDOW_MS = 3_000;

interface ShortcutsStoreState extends ShortcutsSettings {
  isRecording: boolean;
  volumeStep: VolumeStep;
  volumeHoldRepeats: boolean;
  globalStatus: GlobalShortcutStatusMap;
  rejectedGlobal: RejectedGlobalShortcut | null;
  setIsRecording: (recording: boolean) => void;
  setVolumeStep: (step: VolumeStep) => void;
  setVolumeHoldRepeats: (holdRepeats: boolean) => void;
  setGlobalStatus: (status: GlobalShortcutStatusMap) => void;
  clearRejectedGlobal: () => void;
  setGlobalShortcut: (
    action: keyof GlobalShortcutsSettings,
    rawShortcut: string,
  ) => void;
  commitGlobalShortcut: (
    action: keyof GlobalShortcutsSettings,
    rawShortcut: string,
  ) => void;
  setMainAppShortcut: (
    action: keyof MainAppShortcutsSettings,
    rawShortcut: string,
  ) => void;
  setMiniplayerShortcut: (
    action: keyof MiniplayerShortcutsSettings,
    rawShortcut: string,
  ) => void;
  resetShortcut: (scope: ShortcutScope, action: string) => void;
  resetSection: (scope: ShortcutScope) => void;
  resetAll: () => void;
}

function pickKnownShortcuts<T extends object>(
  defaults: T,
  saved: Partial<T> | undefined,
): T {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = saved?.[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
}

const SHORTCUTS_STORAGE_KEY = "liner_shortcuts_settings_v1";

let pendingGlobalEdit: PendingGlobalEdit | null = null;

function notifyElectronGlobalShortcuts(
  global: GlobalShortcutsSettings,
  volumeHoldRepeats?: boolean,
) {
  if (
    typeof window !== "undefined" &&
    window.linerElectron?.updateOverlaySettings
  ) {
    window.linerElectron.updateOverlaySettings({
      shortcut: global.toggleOverlay,
      likeShortcut: global.quickLikeSong,
      mediaShortcuts: Object.fromEntries(
        OPTIONAL_GLOBAL_ACTIONS.map((action) => [action, global[action]]),
      ),
      ...(volumeHoldRepeats === undefined ? {} : { volumeHoldRepeats }),
    });
  }
}

export const useShortcutsStore = create<ShortcutsStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SHORTCUTS,
      isRecording: false,
      volumeStep: DEFAULT_VOLUME_STEP,
      volumeHoldRepeats: true,
      globalStatus: {},
      rejectedGlobal: null,

      setVolumeStep: (step) => {
        if (isVolumeStep(step)) set({ volumeStep: step });
      },

      setVolumeHoldRepeats: (holdRepeats) => {
        set({ volumeHoldRepeats: holdRepeats });
        notifyElectronGlobalShortcuts(get().global, holdRepeats);
      },

      setGlobalStatus: (status) => {
        set({ globalStatus: status });
        const pending = pendingGlobalEdit;
        if (!pending) return;
        if (Date.now() - pending.at > GLOBAL_EDIT_VERDICT_WINDOW_MS) {
          pendingGlobalEdit = null;
          return;
        }
        const verdict = status[pending.action];
        if (!pending.cleared) {
          if (verdict === undefined) pending.cleared = true;
          return;
        }
        if (verdict === "ok") {
          pendingGlobalEdit = null;
          return;
        }
        if (verdict !== "taken" && verdict !== "invalid") return;
        pendingGlobalEdit = null;
        set({
          rejectedGlobal: {
            action: pending.action,
            shortcut: get().global[pending.action],
            reason: verdict,
          },
        });
        get().setGlobalShortcut(pending.action, pending.previous);
      },

      clearRejectedGlobal: () => set({ rejectedGlobal: null }),

      commitGlobalShortcut: (action, rawShortcut) => {
        const previous = get().global[action];
        const next =
          normalizeShortcutToEnglish(rawShortcut) ||
          DEFAULT_SHORTCUTS.global[action];
        if (next === previous) return;
        pendingGlobalEdit = next
          ? {
              action,
              previous,
              at: Date.now(),
              cleared: get().globalStatus[action] === undefined,
            }
          : null;
        set({ rejectedGlobal: null });
        get().setGlobalShortcut(action, rawShortcut);
      },

      setIsRecording: (recording: boolean) => {
        set({ isRecording: recording });
        if (
          typeof window !== "undefined" &&
          window.linerElectron?.pauseOverlayShortcuts
        ) {
          window.linerElectron.pauseOverlayShortcuts(recording);
        }
      },

      setGlobalShortcut: (action, rawShortcut) => {
        const normalized =
          normalizeShortcutToEnglish(rawShortcut) ||
          DEFAULT_SHORTCUTS.global[action];
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
          normalizeShortcutToEnglish(rawShortcut) ||
          DEFAULT_SHORTCUTS.mainApp[action];
        set({
          mainApp: {
            ...get().mainApp,
            [action]: normalized,
          },
        });
      },

      setMiniplayerShortcut: (action, rawShortcut) => {
        const normalized =
          normalizeShortcutToEnglish(rawShortcut) ||
          DEFAULT_SHORTCUTS.miniplayer[action];
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
        } else if (
          scope === "miniplayer" &&
          action in DEFAULT_SHORTCUTS.miniplayer
        ) {
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
        useOverlaySettingsStore.setState({
          shortcut: DEFAULT_SHORTCUTS.global.toggleOverlay,
        });
      },
    }),
    {
      name: SHORTCUTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        global: state.global,
        mainApp: state.mainApp,
        miniplayer: state.miniplayer,
        volumeStep: state.volumeStep,
        volumeHoldRepeats: state.volumeHoldRepeats,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Ensure newly added actions have defaults
        state.global = pickKnownShortcuts(
          DEFAULT_SHORTCUTS.global,
          state.global,
        );
        state.mainApp = pickKnownShortcuts(
          DEFAULT_SHORTCUTS.mainApp,
          state.mainApp,
        );
        state.miniplayer = pickKnownShortcuts(
          DEFAULT_SHORTCUTS.miniplayer,
          state.miniplayer,
        );

        // Normalize all rehydrated shortcuts
        for (const key of Object.keys(
          state.global,
        ) as (keyof GlobalShortcutsSettings)[]) {
          state.global[key] =
            normalizeShortcutToEnglish(state.global[key]) ||
            DEFAULT_SHORTCUTS.global[key];
        }
        for (const key of Object.keys(
          state.mainApp,
        ) as (keyof MainAppShortcutsSettings)[]) {
          state.mainApp[key] =
            normalizeShortcutToEnglish(state.mainApp[key]) ||
            DEFAULT_SHORTCUTS.mainApp[key];
        }
        for (const key of Object.keys(
          state.miniplayer,
        ) as (keyof MiniplayerShortcutsSettings)[]) {
          state.miniplayer[key] =
            normalizeShortcutToEnglish(state.miniplayer[key]) ||
            DEFAULT_SHORTCUTS.miniplayer[key];
        }

        if (!isVolumeStep(state.volumeStep)) {
          state.volumeStep = DEFAULT_VOLUME_STEP;
        }
        if (typeof state.volumeHoldRepeats !== "boolean") {
          state.volumeHoldRepeats = true;
        }

        notifyElectronGlobalShortcuts(state.global, state.volumeHoldRepeats);
      },
    },
  ),
);

export function subscribeToGlobalShortcutStatus(): () => void {
  const api = typeof window !== "undefined" ? window.linerElectron : undefined;
  if (!api?.onShortcutStatus) return () => {};
  const apply = (status: Record<string, string>) =>
    useShortcutsStore
      .getState()
      .setGlobalStatus(status as GlobalShortcutStatusMap);
  const unsubscribe = api.onShortcutStatus(apply);
  void api
    .getShortcutStatus?.()
    .then((status) => {
      if (status) apply(status);
    })
    .catch(() => undefined);
  return unsubscribe;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SHORTCUTS_STORAGE_KEY) {
      void useShortcutsStore.persist.rehydrate();
    }
  });
}
