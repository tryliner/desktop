import { useEffect, useRef } from "react";
import { usePlayerState } from "@/features/player";
import { useListenBrainzStore } from "../store/listenBrainzStore";
import { submitListen, submitPlayingNow } from "../lib/client";

const MAX_LISTEN_MS = 240_000;

// Minimal scrobbler: playing_now on track start, one listen after half the
// track (capped at 4 minutes) has played.
export function useListenBrainzSync() {
  const player = usePlayerState();
  const enabled = useListenBrainzStore((state) => state.enabled);
  const token = useListenBrainzStore((state) => state.token);
  const track = player.currentTrack;
  const playing = player.status === "playing";
  const nowPlayingRef = useRef<string | null>(null);
  const submittedRef = useRef<string | null>(null);
  const trackId = track?.id ?? null;

  useEffect(() => {
    if (!enabled || !token || !trackId || !playing || !track) {
      if (!trackId) nowPlayingRef.current = null;
      return;
    }
    if (nowPlayingRef.current === trackId) return;
    nowPlayingRef.current = trackId;
    void submitPlayingNow(token, track);
  }, [enabled, token, trackId, playing, track]);

  useEffect(() => {
    if (!enabled || !token || !track || !trackId) return;
    if (submittedRef.current === trackId) return;
    const threshold =
      track.durationMs > 0
        ? Math.min(MAX_LISTEN_MS, track.durationMs * 0.5)
        : MAX_LISTEN_MS;
    if (player.positionMs < threshold) return;
    submittedRef.current = trackId;
    void submitListen(token, track, Math.floor(Date.now() / 1000));
  }, [enabled, token, track, trackId, player.positionMs]);
}
