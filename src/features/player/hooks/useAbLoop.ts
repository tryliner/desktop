import { useEffect, useRef } from "react";
import { playerEngine } from "../engine/playerEngine";
import { usePlayerState } from "./usePlayerState";
import { useAbLoopStore } from "../store/abLoopStore";

export function useAbLoop() {
  const player = usePlayerState();
  const positionMs = player.positionMs;
  const trackId = player.currentTrack?.id ?? null;
  const aMs = useAbLoopStore((state) => state.aMs);
  const bMs = useAbLoopStore((state) => state.bMs);
  const clear = useAbLoopStore((state) => state.clear);
  const lastTrackRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastTrackRef.current === trackId) return;
    lastTrackRef.current = trackId;
    clear();
  }, [trackId, clear]);

  useEffect(() => {
    if (aMs === null || bMs === null || bMs <= aMs) return;
    if (positionMs >= bMs) playerEngine.seek(aMs);
  }, [positionMs, aMs, bMs]);
}
