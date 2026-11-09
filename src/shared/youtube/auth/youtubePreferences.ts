import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface YoutubePreferencesState {
  accountPlayback: boolean;
  promptSignIn: boolean;
  syncLibrary: boolean;
  signOutWithLiner: boolean;
  setAccountPlayback: (accountPlayback: boolean) => void;
  setPromptSignIn: (promptSignIn: boolean) => void;
  setSyncLibrary: (syncLibrary: boolean) => void;
  setSignOutWithLiner: (signOutWithLiner: boolean) => void;
}

export const useYoutubePreferences = create<YoutubePreferencesState>()(
  persist(
    (set) => ({
      accountPlayback: true,
      promptSignIn: true,
      syncLibrary: true,
      signOutWithLiner: false,
      setAccountPlayback: (accountPlayback) => set({ accountPlayback }),
      setPromptSignIn: (promptSignIn) => set({ promptSignIn }),
      setSyncLibrary: (syncLibrary) => set({ syncLibrary }),
      setSignOutWithLiner: (signOutWithLiner) => set({ signOutWithLiner }),
    }),
    {
      name: "liner_youtube_preferences",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function prefersAccountPlayback(): boolean {
  return useYoutubePreferences.getState().accountPlayback;
}

export function prefersSignInPrompt(): boolean {
  return useYoutubePreferences.getState().promptSignIn;
}

export function prefersSignOutWithLiner(): boolean {
  return useYoutubePreferences.getState().signOutWithLiner;
}
