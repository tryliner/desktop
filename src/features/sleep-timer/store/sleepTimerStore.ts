import { create } from "zustand";

export type SleepTimerMode =
  | "off"
  | "15"
  | "30"
  | "45"
  | "60"
  | "end_of_track"
  | "custom";

export interface SleepTimerState {
  mode: SleepTimerMode;
  isActive: boolean;
  remainingSeconds: number;
  totalDurationSeconds: number;
  isFadingOut: boolean;
  originalVolume: number | null;
  customMinutes: number;

  startTimer: (
    mode: Exclude<SleepTimerMode, "off">,
    customMinutes?: number,
    currentVolume?: number,
  ) => void;
  cancelTimer: () => void;
  setRemainingSeconds: (seconds: number) => void;
  setIsFadingOut: (fading: boolean) => void;
  tick: () => void;
}

export const useSleepTimerStore = create<SleepTimerState>((set, get) => ({
  mode: "off",
  isActive: false,
  remainingSeconds: 0,
  totalDurationSeconds: 0,
  isFadingOut: false,
  originalVolume: null,
  customMinutes: 20,

  startTimer: (mode, customMinutes = 20, currentVolume = 1) => {
    let seconds = 0;
    if (mode === "15") seconds = 15 * 60;
    else if (mode === "30") seconds = 30 * 60;
    else if (mode === "45") seconds = 45 * 60;
    else if (mode === "60") seconds = 60 * 60;
    else if (mode === "custom") seconds = Math.max(1, customMinutes) * 60;
    else if (mode === "end_of_track") seconds = 0; // calculated dynamically

    set({
      mode,
      isActive: true,
      remainingSeconds: seconds,
      totalDurationSeconds: seconds,
      isFadingOut: false,
      originalVolume: get().originalVolume ?? currentVolume,
      customMinutes,
    });
  },

  cancelTimer: () => {
    set({
      mode: "off",
      isActive: false,
      remainingSeconds: 0,
      totalDurationSeconds: 0,
      isFadingOut: false,
      originalVolume: null,
    });
  },

  setRemainingSeconds: (remainingSeconds: number) => set({ remainingSeconds }),
  setIsFadingOut: (isFadingOut: boolean) => set({ isFadingOut }),

  tick: () => {
    const { isActive, remainingSeconds } = get();
    if (!isActive) return;
    const nextSeconds = Math.max(0, remainingSeconds - 1);
    set({
      remainingSeconds: nextSeconds,
      isFadingOut: nextSeconds <= 60 && nextSeconds > 0,
    });
  },
}));
