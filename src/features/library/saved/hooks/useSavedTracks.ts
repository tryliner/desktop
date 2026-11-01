import { useEffect } from "react";
import { useSavedTracksStore } from "../store/savedTracksStore";

export function useSavedTracks() {
  const tracks = useSavedTracksStore((state) => state.tracks);
  const loadState = useSavedTracksStore((state) => state.loadState);
  const load = useSavedTracksStore((state) => state.load);

  useEffect(() => {
    if (loadState === "idle") void load();
  }, [loadState, load]);

  return {
    tracks,
    isLoading: loadState === "idle" || loadState === "loading",
    isAvailable: loadState !== "unavailable",
  };
}
