import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";

interface ListenBrainzState {
  enabled: boolean;
  token: string;
  username: string;
  setEnabled: (enabled: boolean) => void;
  connect: (token: string, username: string) => void;
  disconnect: () => void;
}

export const useListenBrainzStore = create<ListenBrainzState>()(
  persist(
    (set) => ({
      enabled: false,
      token: "",
      username: "",
      setEnabled: (enabled) =>
        set((state) =>
          state.token.length > 0 ? { enabled } : { enabled: false },
        ),
      connect: (token, username) =>
        set({ token, username, enabled: token.length > 0 }),
      disconnect: () => set({ token: "", username: "", enabled: false }),
    }),
    {
      name: "liner_listenbrainz_v1",
      storage: createJSONStorage(() => debouncedStorage),
    },
  ),
);
