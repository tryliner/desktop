import { create } from "zustand";
import {
  completeYoutubeTvSignIn,
  declineYoutubeSignIn,
  isYoutubeSignedIn,
  startYoutubeTvSignIn,
  YoutubeAuthError,
  type TvDeviceCode,
} from "@/shared/youtube";
import { isAbortError } from "@/shared/utils/abort";
import { playerRuntime, usePlayerStore } from "@/features/player";
import { announceYoutubeConnected } from "../lib/announceConnected";

export type SignInPhase = "requesting" | "waiting" | "error";
export type SignInReason = "playback" | "manual";

interface YoutubeSignInState {
  open: boolean;
  phase: SignInPhase;
  code: TvDeviceCode | null;
  reason: SignInReason;
  show: (reason?: SignInReason) => void;
  dismiss: () => void;
  retry: () => void;
}

let controller: AbortController | null = null;

function resumePlayback(): void {
  const { currentTrack, positionMs } = usePlayerStore.getState();
  if (currentTrack) void playerRuntime?.loadAndPlay(currentTrack, positionMs);
}

async function waitForSignIn(
  signal: AbortSignal,
  onCode: (code: TvDeviceCode) => void,
): Promise<void> {
  for (;;) {
    const code = await startYoutubeTvSignIn(signal);
    onCode(code);
    try {
      await completeYoutubeTvSignIn(code, signal);
      return;
    } catch (error) {
      if (error instanceof YoutubeAuthError && error.code === "expired_token")
        continue;
      throw error;
    }
  }
}

export const useYoutubeSignInStore = create<YoutubeSignInState>((set, get) => {
  const run = async () => {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    set({ phase: "requesting", code: null });
    try {
      await waitForSignIn(current.signal, (code) =>
        set({ phase: "waiting", code }),
      );
      void announceYoutubeConnected();
      const { reason } = get();
      set({ open: false, code: null });
      if (reason === "playback") resumePlayback();
    } catch (error) {
      if (isAbortError(error, current.signal)) return;
      set({ phase: "error" });
    }
  };

  return {
    open: false,
    phase: "requesting",
    code: null,
    reason: "playback",
    show: (reason = "playback") => {
      if (get().open || isYoutubeSignedIn()) return;
      set({ open: true, reason });
      void run();
    },
    dismiss: () => {
      controller?.abort();
      controller = null;
      const { reason } = get();
      set({ open: false, code: null });
      if (reason !== "playback") return;
      declineYoutubeSignIn();
      resumePlayback();
    },
    retry: () => void run(),
  };
});
