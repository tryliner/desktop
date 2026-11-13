import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PinKind = "track" | "playlist" | "album" | "artist";

export interface PinnedTrack {
  id: string;
  title: string;
  artists: string;
  coverUrl: string;
  durationMs: number;
}

export interface PinnedItem {
  key: string;
  kind: PinKind;
  title: string;
  coverUrl: string;
  href?: string;
  track?: PinnedTrack;
}

interface PinState {
  items: PinnedItem[];
  collapsed: boolean;
  toggle: (item: PinnedItem) => void;
  remove: (key: string) => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const MAX_PINS = 30;

export const usePinStore = create<PinState>()(
  persist(
    (set) => ({
      items: [],
      collapsed: false,
      toggle: (item) =>
        set((state) =>
          state.items.some((pin) => pin.key === item.key)
            ? { items: state.items.filter((pin) => pin.key !== item.key) }
            : { items: [item, ...state.items].slice(0, MAX_PINS) },
        ),
      remove: (key) =>
        set((state) => ({
          items: state.items.filter((pin) => pin.key !== key),
        })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: "liner_pins_v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function pinKey(kind: PinKind, id: string): string {
  return `${kind}:${id}`;
}
