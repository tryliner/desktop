import { create } from "zustand";

export type RomanizationStatus = "idle" | "loading" | "ready" | "error";

interface RomanizationRuntime {
  key: string;
  status: RomanizationStatus;
  retryToken: number;
  setStatus: (key: string, status: RomanizationStatus) => void;
  retry: () => void;
}

export const useRomanizationRuntimeStore = create<RomanizationRuntime>(
  (set) => ({
    key: "",
    status: "idle",
    retryToken: 0,
    setStatus: (key, status) =>
      set((state) =>
        state.key === key && state.status === status ? state : { key, status },
      ),
    retry: () => set((state) => ({ retryToken: state.retryToken + 1 })),
  }),
);
