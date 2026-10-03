import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePlayerState } from "@/features/player/hooks/usePlayerState";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { useLyricsStore } from "@/features/lyrics";
import {
  useIsTrackLiked,
  useLikeTrack,
  useUnlikeTrack,
} from "@/features/library/hooks";
import type {
  TouchBarAction,
  TouchBarActiveLine,
  TouchBarStatePayload,
  TouchBarWordData,
} from "../contracts";

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
        case "toggleFullscreen": {
          const currentFs = usePlayerStore.getState().fullscreen || location.pathname === "/player";
          if (currentFs) {
            if (location.pathname === "/player") {
              navigate(-1);
            } else {
              usePlayerStore.getState().setFullscreen(false);
            }
          } else {
            usePlayerStore.getState().setFullscreen(true);
          }
          break;
        }
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
  }, [currentTrack, isLiked, likeMutation, unlikeMutation, navigate, location.pathname]);

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

    let activeLine: TouchBarActiveLine | null = null;
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
        const line = syncedLines[activeIndex];
        const nextLine = syncedLines[activeIndex + 1];
        nextLyricText = nextLine?.text || "";

        const lineDurationMs = nextLine
          ? Math.max(800, nextLine.timeMs - line.timeMs)
          : 4000;

        let words: TouchBarWordData[] = [];
        if (line.words && line.words.length > 0) {
          words = line.words.map((w) => ({
            text: w.text,
            timeMs: w.timeMs,
            endMs: w.endMs,
          }));
        } else if (line.text.trim()) {
          const tokens = line.text.trim().split(/\s+/);
          const perWordDuration = lineDurationMs / tokens.length;
          words = tokens.map((token, i) => ({
            text: token + (i < tokens.length - 1 ? " " : ""),
            timeMs: line.timeMs + i * perWordDuration,
            endMs: line.timeMs + (i + 1) * perWordDuration,
          }));
        }

        activeLine = {
          text: line.text,
          timeMs: line.timeMs,
          durationMs: lineDurationMs,
          words,
        };
      } else {
        nextLyricText = syncedLines[0]?.text || "";
      }
    }

    const isFullscreen = location.pathname === "/player" || Boolean(player.fullscreen);

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
      activeLine,
      activeLyricText: activeLine?.text || "",
      nextLyricText,
      offsetMs,
      currentRoute: location.pathname,
      isFullscreen,
    };

    const serialized = JSON.stringify({
      s: payload.status,
      id: payload.track?.id,
      p: Math.floor(payload.positionMs / 250),
      v: Math.round(payload.volume * 100),
      l: payload.isLiked,
      sh: payload.shuffle,
      ly: payload.activeLyricText,
      fs: payload.isFullscreen,
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
    player.fullscreen,
    currentTrack,
    isLiked,
    syncedLines,
    offsetMs,
    location.pathname,
  ]);
}
