import { create } from "zustand";

interface AbLoopState {
  aMs: number | null;
  bMs: number | null;
  setA: (positionMs: number) => void;
  setB: (positionMs: number) => void;
  clear: () => void;
}

export const useAbLoopStore = create<AbLoopState>((set) => ({
  aMs: null,
  bMs: null,
  setA: (positionMs) => set({ aMs: Math.max(0, positionMs), bMs: null }),
  setB: (positionMs) => set({ bMs: Math.max(0, positionMs) }),
  clear: () => set({ aMs: null, bMs: null }),
}));
