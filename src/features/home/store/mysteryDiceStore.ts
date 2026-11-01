import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "@/shared/types/track";
import type { MysteryGenre } from "../services/mysteryDice";

interface MysteryDiceState {
  revealedGenre: MysteryGenre | null;
  revealedTracks: Track[];
  isRolled: boolean;
  setRevealed: (genre: MysteryGenre, tracks: Track[]) => void;
  reset: () => void;
}

export const useMysteryDiceStore = create<MysteryDiceState>()(
  persist(
    (set) => ({
      revealedGenre: null,
      revealedTracks: [],
      isRolled: false,
      setRevealed: (genre, tracks) =>
        set({
          revealedGenre: genre,
          revealedTracks: tracks,
          isRolled: true,
        }),
      reset: () =>
        set({
          revealedGenre: null,
          revealedTracks: [],
          isRolled: false,
        }),
    }),
    {
      name: "liner-mystery-dice-state",
    },
  ),
);
