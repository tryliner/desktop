import { useEffect } from "react";
import { onYoutubeSignInRequested } from "@/shared/youtube";
import { useYoutubeSignInStore } from "../store/youtubeSignInStore";

export function useYoutubeSignInPrompt(): void {
  const show = useYoutubeSignInStore((state) => state.show);
  useEffect(() => onYoutubeSignInRequested(() => show("playback")), [show]);
}
