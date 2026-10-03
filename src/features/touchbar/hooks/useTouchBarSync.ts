import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePlayerState } from "@/features/player/hooks/usePlayerState";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { useLyricsStore } from "@/features/lyrics";
import {
  useIsTrackLiked,
  useLikeTrack,
  useUnlikeTrack,
} from "@/features/library/hooks";
import type { TouchBarAction, TouchBarStatePayload } from "../contracts";

export function useTouchBarSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const player = usePlayerState();
  const syncedLines = useLyricsStore((s) => s.syncedLines);
  const offsetMs = useLyricsStore((s) => s.offsetMs);
  const currentTrack = player.currentTrack;
  const isLiked = useIsTrackLiked(currentTrack?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();
  const isTogglingLikeRef = useRef(false);
  const lastStateSentRef = useRef<string>("");

  useEffect(() => {
    if (!window.linerElectron?.onTouchBarAction) return;

    const cleanup = window.linerElectron.onTouchBarAction((action: TouchBarAction) => {
      switch (action.type) {
        case "togglePlay":
          void playerEngine.togglePlayPause();
          break;
        case "play":
          void playerEngine.resume();
          break;
        case "pause":
          playerEngine.pause();
          break;
        case "next":
          void playerEngine.skipNext(true);
          break;
        case "prev":
          void playerEngine.skipPrevious();
          break;
        case "seek":
          if (typeof action.payload?.positionMs === "number") {
            playerEngine.seek(action.payload.positionMs);
          }
          break;
        case "volume":
          if (typeof action.payload?.volume === "number") {
            playerEngine.setVolume(action.payload.volume);
          }
          break;
        case "toggleShuffle":
          playerEngine.setShuffle(!playerEngine.getSnapshot().shuffle);
          break;
        case "adjustOffset":
          if (typeof action.payload?.deltaMs === "number") {
            useLyricsStore.getState().adjustOffset(action.payload.deltaMs);
          }
          break;
        case "like":
          if (currentTrack && !isTogglingLikeRef.current) {
            isTogglingLikeRef.current = true;
            const onSettled = () => {
              isTogglingLikeRef.current = false;
            };
            if (isLiked) {
              unlikeMutation.mutate(currentTrack.id, { onSettled });
            } else {
              likeMutation.mutate(currentTrack.id, { onSettled });
            }
          }
          break;
        case "navigate":
          if (action.payload?.route) {
            navigate(action.payload.route);
          }
          break;
      }
    });

    return cleanup;
  }, [currentTrack, isLiked, likeMutation, unlikeMutation, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyT") {
        e.preventDefault();
        window.linerElectron?.toggleTouchBarSimulator?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!window.linerElectron?.touchbarUpdateState) return;

    let activeLyricText = "";
    let nextLyricText = "";

    if (syncedLines.length > 0) {
      const effectiveTimeMs = player.positionMs + offsetMs;
      let activeIndex = -1;
      for (let i = 0; i < syncedLines.length; i++) {
        if (syncedLines[i].timeMs <= effectiveTimeMs) {
          activeIndex = i;
        } else {
          break;
        }
      }
      if (activeIndex >= 0) {
        activeLyricText = syncedLines[activeIndex]?.text || "";
        nextLyricText = syncedLines[activeIndex + 1]?.text || "";
      } else {
        nextLyricText = syncedLines[0]?.text || "";
      }
    }

    const payload: TouchBarStatePayload = {
      status: player.status,
      track: currentTrack
        ? {
            id: currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artists || "",
            album: currentTrack.album?.title || "",
            cover: currentTrack.coverUrl,
            durationMs: currentTrack.durationMs,
          }
        : null,
      positionMs: player.positionMs,
      durationMs: player.durationMs || currentTrack?.durationMs || 0,
      volume: player.volume,
      isLiked,
      shuffle: player.shuffle,
      repeat: player.repeat,
      activeLyricText,
      nextLyricText,
      offsetMs,
      currentRoute: location.pathname,
    };

    const serialized = JSON.stringify({
      s: payload.status,
      id: payload.track?.id,
      p: Math.floor(payload.positionMs / 250),
      v: payload.volume,
      l: payload.isLiked,
      sh: payload.shuffle,
      ly: payload.activeLyricText,
      r: payload.currentRoute,
    });

    if (serialized !== lastStateSentRef.current) {
      lastStateSentRef.current = serialized;
      window.linerElectron.touchbarUpdateState(payload);
    }
  }, [
    player.status,
    player.positionMs,
    player.durationMs,
    player.volume,
    player.shuffle,
    player.repeat,
    currentTrack,
    isLiked,
    syncedLines,
    offsetMs,
    location.pathname,
  ]);
}
