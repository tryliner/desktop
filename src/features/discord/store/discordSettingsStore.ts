import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_DISCORD_SETTINGS,
  DEFAULT_DISCORD_CLIENT_ID,
  type DiscordRpcSettings,
  type DiscordStatusDisplayType,
} from "../contracts";

interface DiscordSettingsState extends DiscordRpcSettings {
  setEnabled: (enabled: boolean) => void;
  setApplicationId: (applicationId: string) => void;
  resetApplicationId: () => void;
  setStatusDisplayType: (statusDisplayType: DiscordStatusDisplayType) => void;
  setShowArtwork: (showArtwork: boolean) => void;
  setShowArtistSmallImage: (showArtistSmallImage: boolean) => void;
  setShowTime: (showTime: boolean) => void;
  setShowPaused: (showPaused: boolean) => void;
  setShowButton: (showButton: boolean) => void;
  setShowDownloadButton: (showDownloadButton: boolean) => void;
}

function notifyElectron(patch: Partial<DiscordRpcSettings>) {
  if (typeof window !== "undefined" && window.linerElectron?.discordUpdateSettings) {
    window.linerElectron.discordUpdateSettings(patch);
  }
}

export const useDiscordSettingsStore = create<DiscordSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_DISCORD_SETTINGS,
      setEnabled: (enabled) => {
        set({ enabled });
        notifyElectron({ enabled });
      },
      setApplicationId: (rawId) => {
        const applicationId = rawId.trim() || DEFAULT_DISCORD_CLIENT_ID;
        set({ applicationId });
        notifyElectron({ applicationId });
      },
      resetApplicationId: () => {
        set({ applicationId: DEFAULT_DISCORD_CLIENT_ID });
        notifyElectron({ applicationId: DEFAULT_DISCORD_CLIENT_ID });
      },
      setStatusDisplayType: (statusDisplayType) => {
        set({ statusDisplayType });
        notifyElectron({ statusDisplayType });
      },
      setShowArtwork: (showArtwork) => {
        set({ showArtwork });
        notifyElectron({ showArtwork });
      },
      setShowArtistSmallImage: (showArtistSmallImage) => {
        set({ showArtistSmallImage });
        notifyElectron({ showArtistSmallImage });
      },
      setShowTime: (showTime) => {
        set({ showTime });
        notifyElectron({ showTime });
      },
      setShowPaused: (showPaused) => {
        set({ showPaused });
        notifyElectron({ showPaused });
      },
      setShowButton: (showButton) => {
        set({ showButton });
        notifyElectron({ showButton });
      },
      setShowDownloadButton: (showDownloadButton) => {
        set({ showDownloadButton });
        notifyElectron({ showDownloadButton });
      },
    }),
    {
      name: "liner_discord_settings_v1",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.applicationId === "1165957668758900787" || !state.applicationId) {
            state.setApplicationId(DEFAULT_DISCORD_CLIENT_ID);
          }
          if (typeof state.showDownloadButton !== "boolean") {
            state.setShowDownloadButton(true);
          }
          if (!state.statusDisplayType) {
            state.setStatusDisplayType("artist");
          }
        }
      },
    }
  )
);
