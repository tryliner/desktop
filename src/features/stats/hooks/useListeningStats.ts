import { useEffect, useRef } from "react";
import { usePlayerState } from "@/features/player";
import type { Track } from "@/shared/types";
import { useStatsStore } from "../store/statsStore";

const TICK_MS = 10_000;
const MIN_PLAY_MS = 30_000;

export function useListeningStats() {
  const player = usePlayerState();
  const currentTrack = player.currentTrack;
  const status = player.status;
  const recordListen = useStatsStore((state) => state.recordListen);
  const addListening = useStatsStore((state) => state.addListening);
  const activeRef = useRef<{
    id: string;
    track: Track;
    listenedMs: number;
  } | null>(null);

  useEffect(() => {
    const previous = activeRef.current;
    if (previous && previous.id !== currentTrack?.id) {
      if (previous.listenedMs >= MIN_PLAY_MS) {
        recordListen(previous.track);
      }
    }
    activeRef.current = currentTrack
      ? { id: currentTrack.id, track: currentTrack, listenedMs: 0 }
      : null;
  }, [currentTrack, recordListen]);

  useEffect(() => {
    if (status !== "playing" || !currentTrack) return;
    const timer = setInterval(() => {
      const active = activeRef.current;
      if (!active || active.id !== currentTrack.id) return;
      active.listenedMs += TICK_MS;
      addListening(active.track, TICK_MS);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [status, currentTrack, addListening]);
}
