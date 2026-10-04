import { useEffect, useRef, useState } from "react";
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
  const activeLineIndex = useLyricsStore((s) => s.activeLineIndex);
  const currentTrack = player.currentTrack;
  const isLiked = useIsTrackLiked(currentTrack?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();
  const isTogglingLikeRef = useRef(false);
  const lastStateSentRef = useRef<string>("");
  const [syncRequestTick, setSyncRequestTick] = useState(0);

  useEffect(() => {
    if (!window.linerElectron?.onTouchBarRequestSync) return;
    const cleanup = window.linerElectron.onTouchBarRequestSync(() => {
      lastStateSentRef.current = "";
      setSyncRequestTick((t) => t + 1);
    });
    return cleanup;
  }, []);

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
      if (
        ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyT") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyM")
      ) {
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
    let activeIndex = -1;

    const audioEl =
      typeof document !== "undefined"
        ? (document.getElementById("liner-audio") as HTMLAudioElement | null)
        : null;
    const currentAudioMs =
      audioEl && !Number.isNaN(audioEl.currentTime)
        ? Math.round(audioEl.currentTime * 1000)
        : player.positionMs;

    if (syncedLines.length > 0) {
      if (
        typeof activeLineIndex === "number" &&
        activeLineIndex >= 0 &&
        activeLineIndex < syncedLines.length
      ) {
        activeIndex = activeLineIndex;
      } else {
        for (let i = 0; i < syncedLines.length; i++) {
          const prevEnd =
            i > 0 && syncedLines[i - 1].words && syncedLines[i - 1].words!.length > 0
              ? syncedLines[i - 1].words![syncedLines[i - 1].words!.length - 1].endMs
              : i > 0
                ? syncedLines[i - 1].timeMs
                : 0;
          const targetEarlyMs = Math.max(prevEnd, syncedLines[i].timeMs - 600);
          if (targetEarlyMs <= currentAudioMs) {
            activeIndex = i;
          } else {
            break;
          }
        }
      }

      if (activeIndex >= 0) {
        const line = syncedLines[activeIndex];
        const nextLine = syncedLines[activeIndex + 1];
        const upcomingLine = syncedLines.slice(activeIndex + 1).find((l) => Boolean(l.text && l.text.trim()));
        nextLyricText = upcomingLine?.text || "";

        const lineDurationMs = nextLine
          ? Math.max(800, nextLine.timeMs - line.timeMs)
          : 4000;

        let words: TouchBarWordData[] = [];
        if (line.words && line.words.length > 0) {
          const rawWords = line.words;
          const lineText = line.text || "";
          let charCursor = 0;

          for (let i = 0; i < rawWords.length; i++) {
            const w = rawWords[i];
            if (!w || !w.text) continue;

            if (w.text.trim().length === 0) {
              if (words.length > 0) {
                words[words.length - 1].text += w.text;
              }
              continue;
            }

            const cleanText = w.text.trim();
            const foundIdx = lineText.indexOf(cleanText, charCursor);

            let isContinuationOfPrevWord = false;
            if (words.length > 0) {
              const prev = words[words.length - 1];
              const prevEndsSpace = /\s$/.test(prev.text);
              const currStartsSpace = /^\s/.test(w.text);

              if (foundIdx >= 0) {
                const textBetween = lineText.slice(charCursor, foundIdx);
                const hasSpaceBetween = /\s/.test(textBetween);
                if (!hasSpaceBetween && !prevEndsSpace && !currStartsSpace) {
                  isContinuationOfPrevWord = true;
                }
              } else if (!prevEndsSpace && !currStartsSpace) {
                isContinuationOfPrevWord = true;
              }
            }

            if (foundIdx >= 0) {
              charCursor = foundIdx + cleanText.length;
            }

            if (isContinuationOfPrevWord && words.length > 0) {
              const prev = words[words.length - 1];
              prev.text += w.text;
              prev.endMs = Math.max(prev.endMs, w.endMs);
            } else {
              words.push({
                text: w.text,
                timeMs: w.timeMs,
                endMs: w.endMs,
              });
            }
          }
        }

        const isInstrumental = Boolean(
          line.isInstrumental ||
          (line.text.trim() === "" && (!line.words || line.words.length === 0)) ||
          line.text.trim() === "♪"
        );

        activeLine = {
          text: line.text,
          timeMs: line.timeMs,
          durationMs: line.durationMs || lineDurationMs,
          words,
          isInstrumental,
        };
      } else {
        const firstLine = syncedLines[0];
        if (firstLine && firstLine.timeMs > 3000 && currentAudioMs < firstLine.timeMs - 600) {
          activeLine = {
            text: "",
            timeMs: 0,
            durationMs: firstLine.timeMs,
            words: [],
            isInstrumental: true,
          };
          nextLyricText = firstLine.text || "";
        } else {
          nextLyricText = firstLine?.text || "";
        }
      }
    }

    const hasSyncedLyrics =
      syncedLines.length > 0 &&
      syncedLines.some(
        (l) => (l.timeMs ?? 0) > 0 || Boolean((l.durationMs ?? 0) > 0 && l.isInstrumental),
      );

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
      positionMs: currentAudioMs,
      durationMs: player.durationMs || currentTrack?.durationMs || 0,
      volume: player.volume,
      isLiked,
      shuffle: player.shuffle,
      repeat: player.repeat,
      activeLine: hasSyncedLyrics ? activeLine : null,
      activeLyricText: hasSyncedLyrics ? (activeLine?.text || "") : "",
      nextLyricText: hasSyncedLyrics ? nextLyricText : "",
      offsetMs,
      currentRoute: location.pathname,
      isFullscreen,
      hasSyncedLyrics,
    };

    const serialized = JSON.stringify({
      s: payload.status,
      id: payload.track?.id,
      p: Math.floor(payload.positionMs / 250),
      v: Math.round(payload.volume * 100),
      l: payload.isLiked,
      sh: payload.shuffle,
      ly: payload.activeLyricText,
      li: activeIndex,
      fs: payload.isFullscreen,
      sl: payload.hasSyncedLyrics,
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
    activeLineIndex,
    location.pathname,
    syncRequestTick,
  ]);
}
