import { useEffect } from "react";
import { usePlayerState } from "./usePlayerState";

export function useTraySync() {
  const track = usePlayerState().currentTrack;
  const title = track?.title;
  const artist = track?.artists;

  useEffect(() => {
    window.linerElectron?.trayUpdateState?.(
      title ? { title, artist: artist || "Unknown artist" } : null,
    );
  }, [title, artist]);
}
