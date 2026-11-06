import { create } from "zustand";
import { setHumanCheckPrompt, type HumanCheckRequest } from "@/shared/api";

export type HumanCheckPhase = "loading" | "ready" | "expired" | "error";

interface HumanCheckState {
  request: HumanCheckRequest | null;
  phase: HumanCheckPhase;
  attempt: number;
  open: (request: HumanCheckRequest) => Promise<string | null>;
  setPhase: (phase: HumanCheckPhase) => void;
  solve: (token: string) => void;
  retry: () => void;
  cancel: () => void;
}

let settle: ((token: string | null) => void) | null = null;

function finish(token: string | null) {
  const done = settle;
  settle = null;
  done?.(token);
}

export const useHumanCheckStore = create<HumanCheckState>((set) => ({
  request: null,
  phase: "loading",
  attempt: 0,

  open: (request) => {
    finish(null);
    set((state) => ({
      request,
      phase: "loading",
      attempt: state.attempt + 1,
    }));
    return new Promise((resolve) => {
      settle = resolve;
    });
  },

  setPhase: (phase) => set({ phase }),

  solve: (token) => {
    set({ request: null });
    finish(token);
  },

  retry: () =>
    set((state) => ({ phase: "loading", attempt: state.attempt + 1 })),

  cancel: () => {
    set({ request: null });
    finish(null);
  },
}));

setHumanCheckPrompt((request) => useHumanCheckStore.getState().open(request));
